import {
    ADDRESS_CLAMP_TO_EDGE,
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    FILTER_NEAREST,
    PIXELFORMAT_R8,
    PIXELFORMAT_R16U,
    Asset,
    BlendState,
    BoundingBox,
    Color,
    Entity,
    GSplatData,
    GSplatResource,
    Mat4,
    Quat,
    Texture,
    Vec3,
    MeshInstance
} from 'playcanvas';

import { BufferWriter, ProgressWriter, ProgressASCIIWriter, Writer } from './serialize/writer';

type ProgressFunc = (loaded: number, total: number) => void;


// 输出点云 ply 文件（支持 binary 或 ascii）
const serializePcdPly = async (
    points: Vec3[],
    colors: Vec3[],
    writer: Writer,
    progress?: ProgressFunc,
    ascii: boolean = false   // 新增参数，默认 binary
): Promise<boolean> => {

    if (points.length !== colors.length) {
        throw new Error('points and colors length mismatch');
    }

    const vertexCount = points.length;
    const BYTES_PER_POINT = 16; // 3 float32 + 4 uchar (binary)

    // ---------- header ----------
    const headerText = [
        'ply',
        `format ${ascii ? 'ascii 1.0' : 'binary_little_endian 1.0'}`,
        `element vertex ${vertexCount}`,
        'property float x',
        'property float y',
        'property float z',
        'property uchar red',
        'property uchar green',
        'property uchar blue',
        'property uchar alpha',
        'end_header\n'
    ].join('\n');

    const encoder = new TextEncoder();
    const header = encoder.encode(headerText);

    let totalBytes: number;
    let progressWriter: Writer;
    if (ascii) {
        // ASCII 粗略估算，每行约 64 字节
        totalBytes = header.byteLength + vertexCount * 64;
        progressWriter = new ProgressASCIIWriter(writer, totalBytes, progress);
    } else {
        totalBytes = header.byteLength + vertexCount * BYTES_PER_POINT;
        progressWriter = new ProgressWriter(writer, totalBytes, progress);
    }

    // write header
    await progressWriter.write(header);

    // ---------- body ----------
    if (ascii) {
        // ---------- ASCII 写法 ----------
        const CHUNK_POINTS = 4096; // 每次写 4096 行
        let lines: string[] = [];

        for (let i = 0; i < vertexCount; i++) {
            const p = points[i];
            const c = colors[i];

            const r = Math.round(Math.min(1, Math.max(0, c.x)) * 255);
            const g = Math.round(Math.min(1, Math.max(0, c.y)) * 255);
            const b = Math.round(Math.min(1, Math.max(0, c.z)) * 255);

            lines.push(`${p.x} ${p.y} ${p.z} ${r} ${g} ${b} 255`);

            if (lines.length === CHUNK_POINTS) {
                const chunk = encoder.encode(lines.join('\n') + '\n');
                await progressWriter.write(chunk);
                lines.length = 0;
            }
        }

        // flush 剩余行
        if (lines.length > 0) {
            const chunk = encoder.encode(lines.join('\n') + '\n');
            await progressWriter.write(chunk);
        }

    } else {
        // ---------- binary 写法 ----------
        const CHUNK_POINTS = 4096;
        const buffer = new Uint8Array(CHUNK_POINTS * BYTES_PER_POINT);
        const view = new DataView(buffer.buffer);
        let offset = 0;

        for (let i = 0; i < vertexCount; i++) {
            const p = points[i];
            const c = colors[i];

            view.setFloat32(offset, p.x, true); offset += 4;
            view.setFloat32(offset, p.y, true); offset += 4;
            view.setFloat32(offset, p.z, true); offset += 4;

            view.setUint8(offset++, Math.round(Math.min(1, Math.max(0, c.x)) * 255));
            view.setUint8(offset++, Math.round(Math.min(1, Math.max(0, c.y)) * 255));
            view.setUint8(offset++, Math.round(Math.min(1, Math.max(0, c.z)) * 255));
            view.setUint8(offset++, 255);

            if (offset === buffer.byteLength) {
                await progressWriter.write(buffer);
                offset = 0;
            }
        }

        if (offset > 0) {
            await progressWriter.write(buffer.subarray(0, offset));
        }
    }

    await progressWriter.close();
    return true;
};



export { serializePcdPly };
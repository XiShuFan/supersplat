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


const RGB2SH = (colors: Vec3[]): Vec3[] => {
    const C0 = 0.28209479177387814;
    return colors.map(c => (new Vec3(
        (c.x - 0.5) / C0,
        (c.y - 0.5) / C0,
        (c.z - 0.5) / C0
    )));
};

function inverseSigmoid(x: number): number {
    // 数值稳定处理：避免 x=0 或 x=1 时 log(0) 或除零
    const eps = 1e-7;
    x = Math.max(eps, Math.min(1 - eps, x));
    return Math.log(x / (1 - x));
}



// 输出高斯 PLY 文件（符合 Gaussian Splatting 标准格式）
const serializeGaussianPly = async (
    points: Vec3[],
    colors: Vec3[],
    scales: Vec3[],
    writer: Writer,
    progress?: ProgressFunc,
    ascii: boolean = false
): Promise<boolean> => {

    if (
        points.length !== colors.length ||
        points.length !== scales.length
    ) {
        throw new Error('All input arrays must have the same length');
    }

    const vertexCount = points.length;

    const shCoeffs: Vec3[] = RGB2SH(colors);
    const opacities: number[] = Array(vertexCount).fill(inverseSigmoid(0.9));
    scales = scales.map(s => (new Vec3(
        Math.log(s.x),
        Math.log(s.y),
        Math.log(s.z),
    )))

    // ---------- header ----------
    const headerLines = [
        'ply',
        `format ${ascii ? 'ascii 1.0' : 'binary_little_endian 1.0'}`,
        `element vertex ${vertexCount}`,
        'property float x',
        'property float y',
        'property float z',
        'property float f_dc_0',
        'property float f_dc_1',
        'property float f_dc_2',
        'property float opacity',
        'property float scale_0',
        'property float scale_1',
        'property float scale_2',
        'property float rot_0',
        'property float rot_1',
        'property float rot_2',
        'property float rot_3',
        'end_header\n'
    ];

    const headerText = headerLines.join('\n');
    const encoder = new TextEncoder();
    const header = encoder.encode(headerText);

    const BYTES_PER_POINT = 4 * 14; // 14 floats × 4 bytes
    let totalBytes: number;
    let progressWriter: Writer;

    if (ascii) {
        totalBytes = header.byteLength + vertexCount * 200; // 粗略估计
        progressWriter = new ProgressASCIIWriter(writer, totalBytes, progress);
    } else {
        totalBytes = header.byteLength + vertexCount * BYTES_PER_POINT;
        progressWriter = new ProgressWriter(writer, totalBytes, progress);
    }

    await progressWriter.write(header);

    // ---------- body ----------
    if (ascii) {
        const CHUNK_POINTS = 4096;
        let lines: string[] = [];

        for (let i = 0; i < vertexCount; i++) {
            const p = points[i];
            const sh = shCoeffs[i];
            const opacity = opacities[i];
            const s = scales[i];

            lines.push(
                `${p.x} ${p.y} ${p.z} ` +
                `${sh.x} ${sh.y} ${sh.z} ` +
                `${opacity} ` +
                `${s.x} ${s.y} ${s.z} ` +
                `0.0 0.0 0.0 0.0`
            );

            if (lines.length === CHUNK_POINTS) {
                const chunk = encoder.encode(lines.join('\n') + '\n');
                await progressWriter.write(chunk);
                lines.length = 0;
            }
        }

        if (lines.length > 0) {
            const chunk = encoder.encode(lines.join('\n') + '\n');
            await progressWriter.write(chunk);
        }
    } else {
        const CHUNK_POINTS = 4096;
        const buffer = new Uint8Array(CHUNK_POINTS * BYTES_PER_POINT);
        const view = new DataView(buffer.buffer);
        let offset = 0;

        for (let i = 0; i < vertexCount; i++) {
            const p = points[i];
            const sh = shCoeffs[i];
            const opacity = opacities[i];
            const s = scales[i];

            const setF32 = (v: number) => {
                view.setFloat32(offset, v, true);
                offset += 4;
            };

            setF32(p.x);
            setF32(p.y);
            setF32(p.z);
            setF32(sh.x);
            setF32(sh.y);
            setF32(sh.z);
            setF32(opacity);
            setF32(s.x);
            setF32(s.y);
            setF32(s.z);
            setF32(0.0);
            setF32(0.0);
            setF32(0.0);
            setF32(0.0);

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


export { serializePcdPly, serializeGaussianPly };
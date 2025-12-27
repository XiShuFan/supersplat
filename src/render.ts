import { BufferTarget, EncodedPacket, EncodedVideoPacketSource, MkvOutputFormat, MovOutputFormat, Mp4OutputFormat, Output, StreamTarget, WebMOutputFormat } from 'mediabunny';
import { path, Vec3 } from 'playcanvas';

import { ElementType } from './element';
import { Events } from './events';
import { PngCompressor } from './png-compressor';
import { Scene } from './scene';
import { Splat } from './splat';
import { localize } from './ui/localization';
import { Camera } from './camera';
import { SelectOp } from './edit-ops';

type ImageSettings = {
    width: number;
    height: number;
    transparentBg: boolean;
    showDebug: boolean;
};

type ImageBuffers = {
    width: number;
    height: number;
    buffer: ArrayBuffer;
    rgba: Uint8Array;
    url: string;
    uploadRgba: Uint8Array;
}

type PixelHit = {
    splat: Splat;       // 距离最近的高斯
    position: Vec3;     // 空间点位置
    distance: number;   // 距离
    pickId: number;     // 对应的高斯id
};

type VideoSettings = {
    startFrame: number;
    endFrame: number;
    frameRate: number;
    width: number;
    height: number;
    bitrate: number;
    transparentBg: boolean;
    showDebug: boolean;
    format: 'mp4' | 'webm' | 'mov' | 'mkv';
    codec: 'h264' | 'h265' | 'vp9' | 'av1';
};

const removeExtension = (filename: string) => {
    return filename.substring(0, filename.length - path.getExtension(filename).length);
};

const downloadFile = (arrayBuffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.download = filename;
    el.href = url;
    el.click();
    window.URL.revokeObjectURL(url);
};

const registerRenderEvents = (scene: Scene, events: Events) => {
    let compressor: PngCompressor;

    // wait for postrender to fire
    const postRender = () => {
        return new Promise<boolean>((resolve, reject) => {
            const handle = scene.events.on('postrender', () => {
                handle.off();
                try {
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            });
        });
    };

    events.function('render.offscreen', async (width: number, height: number): Promise<Uint8Array> => {
        try {
            // start rendering to offscreen buffer only
            scene.camera.startOffscreenMode(width, height);
            scene.camera.renderOverlays = false;
            scene.gizmoLayer.enabled = false;

            // render the next frame
            scene.forceRender = true;

            // for render to finish
            await postRender();

            // cpu-side buffer to read pixels into
            const data = new Uint8Array(width * height * 4);

            const { renderTarget } = scene.camera.entity.camera;
            const { workRenderTarget } = scene.camera;

            scene.dataProcessor.copyRt(renderTarget, workRenderTarget);

            // read the rendered frame
            await workRenderTarget.colorBuffer.read(0, 0, width, height, { renderTarget: workRenderTarget, data });

            // flip y positions to have 0,0 at the top
            let line = new Uint8Array(width * 4);
            for (let y = 0; y < height / 2; y++) {
                line = data.slice(y * width * 4, (y + 1) * width * 4);
                data.copyWithin(y * width * 4, (height - y - 1) * width * 4, (height - y) * width * 4);
                data.set(line, (height - y - 1) * width * 4);
            }

            return data;
        } finally {
            scene.camera.endOffscreenMode();
            scene.camera.renderOverlays = true;
            scene.gizmoLayer.enabled = true;
            scene.camera.entity.camera.clearColor.set(0, 0, 0, 0);
        }
    });

    events.function('render.image', async (imageSettings: ImageSettings) => {
        events.fire('startSpinner');

        try {
            const { width, height, transparentBg, showDebug } = imageSettings;
            const bgClr = events.invoke('bgClr');

            // start rendering to offscreen buffer only
            scene.camera.startOffscreenMode(width, height);
            scene.camera.renderOverlays = showDebug;
            scene.gizmoLayer.enabled = false;
            if (!transparentBg) {
                scene.camera.entity.camera.clearColor.copy(bgClr);
            }

            // render the next frame
            scene.forceRender = true;

            // for render to finish
            await postRender();

            // cpu-side buffer to read pixels into
            const data = new Uint8Array(width * height * 4);

            const { renderTarget } = scene.camera.entity.camera;
            const { workRenderTarget } = scene.camera;

            scene.dataProcessor.copyRt(renderTarget, workRenderTarget);

            // read the rendered frame
            await workRenderTarget.colorBuffer.read(0, 0, width, height, { renderTarget: workRenderTarget, data });

            // the render buffer contains premultiplied alpha. so apply background color.
            if (!transparentBg) {
                // @ts-ignore
                const pixels = new Uint8ClampedArray(data.buffer);

                const { r, g, b } = bgClr;
                for (let i = 0; i < pixels.length; i += 4) {
                    const a = 255 - pixels[i + 3];
                    pixels[i + 0] += r * a;
                    pixels[i + 1] += g * a;
                    pixels[i + 2] += b * a;
                    pixels[i + 3] = 255;
                }
            }

            // construct the png compressor
            if (!compressor) {
                compressor = new PngCompressor();
            }

            const arrayBuffer = await compressor.compress(
                new Uint32Array(data.buffer),
                width,
                height
            );

            // construct filename
            const selected = events.invoke('selection') as Splat;
            const filename = `${removeExtension(selected?.name ?? 'SuperSplat')}-image.png`;

            // download
            downloadFile(arrayBuffer, filename);

            return true;
        } catch (error) {
            await events.invoke('showPopup', {
                type: 'error',
                header: localize('render.failed'),
                message: `'${error.message ?? error}'`
            });
        } finally {
            scene.camera.endOffscreenMode();
            scene.camera.renderOverlays = true;
            scene.gizmoLayer.enabled = true;
            scene.camera.entity.camera.clearColor.set(0, 0, 0, 0);

            events.fire('stopSpinner');
        }
    });



    events.function('render.image.and.return', async (imageSettings: ImageSettings) => {
        events.fire('startSpinner');

        try {
            const { width, height, transparentBg, showDebug } = imageSettings;
            const bgClr = events.invoke('bgClr');

            // start rendering to offscreen buffer only
            scene.camera.startOffscreenMode(width, height);
            scene.camera.renderOverlays = showDebug;
            scene.gizmoLayer.enabled = false;
            if (!transparentBg) {
                scene.camera.entity.camera.clearColor.copy(bgClr);
            }

            // render the next frame
            scene.forceRender = true;

            // for render to finish
            await postRender();

            // cpu-side buffer to read pixels into
            const data = new Uint8Array(width * height * 4);

            const { renderTarget } = scene.camera.entity.camera;
            const { workRenderTarget } = scene.camera;

            scene.dataProcessor.copyRt(renderTarget, workRenderTarget);

            // read the rendered frame
            await workRenderTarget.colorBuffer.read(0, 0, width, height, { renderTarget: workRenderTarget, data });

            // the render buffer contains premultiplied alpha. so apply background color.
            if (!transparentBg) {
                // @ts-ignore
                const pixels = new Uint8ClampedArray(data.buffer);

                const { r, g, b } = bgClr;
                for (let i = 0; i < pixels.length; i += 4) {
                    const a = 255 - pixels[i + 3];
                    pixels[i + 0] += r * a;
                    pixels[i + 1] += g * a;
                    pixels[i + 2] += b * a;
                    pixels[i + 3] = 255;
                }
            }

            const rgba = data.buffer.slice(0);

            // construct the png compressor
            if (!compressor) {
                compressor = new PngCompressor();
            }

            const arrayBuffer = await compressor.compress(
                new Uint32Array(data.buffer),
                width,
                height
            );

            // 返回图片rgba数据
            return {rgba: rgba, arrayBuffer: arrayBuffer};
        } catch (error) {
            await events.invoke('showPopup', {
                type: 'error',
                header: localize('render.failed'),
                message: `'${error.message ?? error}'`
            });
        } finally {
            scene.camera.endOffscreenMode();
            scene.camera.renderOverlays = true;
            scene.gizmoLayer.enabled = true;
            scene.camera.entity.camera.clearColor.set(0, 0, 0, 0);

            events.fire('stopSpinner');
        }
    });


    events.function('download.image', async (imageArrayBuffer: ArrayBuffer) => {
        try {
            // construct filename
            const selected = events.invoke('selection') as Splat;
            const filename = `${removeExtension(selected?.name ?? 'SuperSplat')}-image.png`;

            // download
            downloadFile(imageArrayBuffer, filename);
            return true;
        } catch (error) {
            await events.invoke('showPopup', {
                type: 'error',
                header: localize('download.image'),
                message: `'${error.message ?? error}'`
            });
        }
    });

    type Candidate = {
        x: number;
        y: number;
        r: number;
        g: number;
        b: number;
    };

    function getLocalNeighborIndices(candidates: Candidate[]): number[][] {
        const n = candidates.length;
        if (n === 0) return [];

        // 构建 (x, y) -> index 的哈希表
        const posToIndex = new Map<string, number>();
        for (let i = 0; i < n; i++) {
            const c = candidates[i];
            posToIndex.set(`${c.x},${c.y}`, i);
        }

        const neighborIndices: number[][] = [];

        for (let i = 0; i < n; i++) {
            const c = candidates[i];
            const neighbors: number[] = [];

            // 遍历 5x5 邻域（dx, dy ∈ [-2, 2]）
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    if (dx === 0 && dy === 0) continue; // 跳过自身

                    const nx = c.x + dx;
                    const ny = c.y + dy;
                    const idx = posToIndex.get(`${nx},${ny}`);
                    if (idx !== undefined) {
                        neighbors.push(idx);
                    }
                }
            }

            neighborIndices.push(neighbors);
        }

        return neighborIndices;
    }


    events.function('render.point.and.download', async (imageBuffers: ImageBuffers) => {
        try {
            const { width, height, buffer: imageArrayBuffer, rgba: rgba, url: previewImageUrl, uploadRgba: uploadRgba } = imageBuffers;
            const camera: Camera = events.invoke("targetCamera");

            console.log("width", width, "height", height);
            const clientWidth = camera.scene.canvas.clientWidth;
            const clientHeight = camera.scene.canvas.clientHeight;
            const targetWidth = camera.scene.targetSize.width;
            const targetHeight = camera.scene.targetSize.height;
            console.log("client width", clientWidth, "client height", clientHeight);
            console.log("target width", targetWidth, "target height", targetHeight);

            // 获取表面点云

            // ---------- 数据 ----------
            const pixels = new Uint8ClampedArray(uploadRgba);
            const origin_pixels = new Uint8ClampedArray(rgba);
            
            const points: Vec3[] = [];
            const colors: Vec3[] = [];
            const scales: Vec3[] = [];
            const pickIds: number[] = [];

            // ---------- 1️⃣ 同步阶段：快速筛选像素 ----------
            const candidates: Candidate[] = [];

            for (let y = 0; y < height; y ++) {
                for (let x = 0; x < width; x ++) {
                    const idx = (y * width + x) * 4;
                    const a = pixels[idx + 3];
                    if (a === 0) continue;

                    const r = pixels[idx + 0];
                    const g = pixels[idx + 1];
                    const b = pixels[idx + 2];
                    if ((r | g | b) === 0) continue; // 比 r===0 && g===0 && b===0 更快

                    const origin_r = origin_pixels[idx + 0];
                    const origin_g = origin_pixels[idx + 1];
                    const origin_b = origin_pixels[idx + 2];
                    // 使用容差判断是否“真正不同”
                    const dr = Math.abs(r - origin_r);
                    const dg = Math.abs(g - origin_g);
                    const db = Math.abs(b - origin_b);
                    const tolerance = 10;

                    if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
                        continue; // 差异太小，跳过
                    }

                    candidates.push({ x, y: height - 1 - y, r, g, b });
                }
            }


            const neighbors = getLocalNeighborIndices(candidates);

            console.log("candidate num:", candidates.length);

            // TODO 慢方法
            // for (let i = 0; i < candidates.length; i += 10) {
            //     let c = candidates[i];
            //     const result = camera.intersect(c.x / width * clientWidth, c.y / height * clientHeight);
            //     if (result != null) {
            //         points.push(result.position);
            //         colors.push(new Vec3(
            //             c.r / 255,
            //             c.g / 255,
            //             c.b / 255
            //         ));
            //     }
            // }

            // 批量获取三维点
            const worldPoints: PixelHit[] = camera.getWorldPointsInCurrentFrame();
            for (let i = 0; i < candidates.length; i ++) {
                const neighborIndices = neighbors[i];
                if (neighborIndices.length === 0) continue; // 没有邻居，跳过

                const c = candidates[i];
                const point: PixelHit = worldPoints[c.y * width + c.x];
                if (!point.splat) continue; // 确保有效

                // 计算当前点到所有邻居的 3D 距离，取最小值
                let minDistSq = Infinity;
                const p = point.position; // 假设是 { x, y, z }

                for (const j of neighborIndices) {
                    const neiCandidate = candidates[j];
                    const neiPixelHit = worldPoints[neiCandidate.y * width + neiCandidate.x];
                    if (!neiPixelHit.splat) continue;

                    const q = neiPixelHit.position;
                    const dx = p.x - q.x;
                    const dy = p.y - q.y;
                    const dz = p.z - q.z;
                    const distSq = dx * dx + dy * dy + dz * dz;

                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                    }
                }

                // 如果没找到有效邻居，跳过
                if (minDistSq === Infinity) continue;

                // 计算 local_scale（仿 3DGS）
                const dist = Math.sqrt(minDistSq);
                const dist2 = Math.max(dist * dist, 1e-7); // 防止 log(0)
                const local_scale = Math.sqrt(dist2);

                // 保存结果
                points.push(point.position);
                colors.push(new Vec3(
                    c.r / 255,
                    c.g / 255,
                    c.b / 255
                ));
                scales.push(new Vec3(local_scale, local_scale, local_scale));
                pickIds.push(point.pickId);
            }

            // TODO 高亮对应的高斯
            // const selected = new Set<number>(pickIds);
            // const filter = (i: number) => {
            //     return selected.has(i);
            // };
            // events.fire('edit.add', new SelectOp(specSplat, 'set', filter));


            console.log("end point cloud, point num:", points.length);
            // 触发下载点云文件
            events.invoke('scene.point.cloud.export', points, colors, scales);

            return true;
        } catch (error) {
            await events.invoke('showPopup', {
                type: 'error',
                header: localize('render.point.and.download'),
                message: `'${error.message ?? error}'`
            });
        }
    });



    events.function('render.video', async (videoSettings: VideoSettings, fileStream: FileSystemWritableFileStream) => {
        events.fire('progressStart', localize('panel.render.render-video'));

        try {
            const { startFrame, endFrame, frameRate, width, height, bitrate, transparentBg, showDebug, format, codec: codecChoice } = videoSettings;

            const target = fileStream ? new StreamTarget(fileStream) : new BufferTarget();

            // Configure output format based on container selection
            let outputFormat: Mp4OutputFormat | MovOutputFormat | MkvOutputFormat | WebMOutputFormat;
            let fileExtension: string;

            if (format === 'webm') {
                outputFormat = new WebMOutputFormat();
                fileExtension = 'webm';
            } else if (format === 'mov') {
                outputFormat = new MovOutputFormat({
                    fastStart: 'in-memory'
                });
                fileExtension = 'mov';
            } else if (format === 'mkv') {
                outputFormat = new MkvOutputFormat();
                fileExtension = 'mkv';
            } else {
                outputFormat = new Mp4OutputFormat({
                    fastStart: 'in-memory'
                });
                fileExtension = 'mp4';
            }

            // Configure codec based on codec selection
            let codecType: 'avc' | 'hevc' | 'vp9' | 'av1';
            let codec: string;

            if (codecChoice === 'h264') {
                codecType = 'avc';
                codec = height < 1080 ? 'avc1.420028' : 'avc1.640033'; // H.264 Constrained Baseline/High profile
            } else if (codecChoice === 'h265') {
                codecType = 'hevc';
                codec = 'hev1.1.6.L120.B0'; // H.265 Main profile, Level 4.0
            } else if (codecChoice === 'vp9') {
                codecType = 'vp9';
                codec = 'vp09.00.10.08'; // VP9 Profile 0, Level 1.0
            } else if (codecChoice === 'av1') {
                codecType = 'av1';
                codec = 'av01.0.05M.08'; // AV1 Main Profile, Level 3.1
            } else {
                codecType = 'avc';
                codec = height < 1080 ? 'avc1.420028' : 'avc1.640033'; // Default: H.264 Constrained Baseline/High
            }

            const output = new Output({
                format: outputFormat,
                target
            });

            const videoSource = new EncodedVideoPacketSource(codecType);
            output.addVideoTrack(videoSource, {
                rotation: 0,
                frameRate
            });

            await output.start();

            const encoder = new VideoEncoder({
                output: async (chunk, meta) => {
                    const encodedPacket = EncodedPacket.fromEncodedChunk(chunk);
                    await videoSource.add(encodedPacket, meta);
                },
                error: (error) => {
                    console.log(error);
                }
            });

            encoder.configure({
                codec,
                width,
                height,
                bitrate
            });

            // start rendering to offscreen buffer only
            scene.camera.startOffscreenMode(width, height);
            scene.camera.renderOverlays = showDebug;
            scene.gizmoLayer.enabled = false;
            if (!transparentBg) {
                scene.camera.entity.camera.clearColor.copy(events.invoke('bgClr'));
            }
            scene.lockedRenderMode = true;

            // cpu-side buffer to read pixels into
            const data = new Uint8Array(width * height * 4);
            const line = new Uint8Array(width * 4);

            // get the list of visible splats
            const splats = (scene.getElementsByType(ElementType.splat) as Splat[]).filter(splat => splat.visible);

            // remember last camera position so we can skip sorting if the camera didn't move
            const last_pos = new Vec3(0, 0, 0);
            const last_forward = new Vec3(1, 0, 0);

            // prepare the frame for rendering
            const prepareFrame = async (frameTime: number) => {
                events.fire('timeline.time', frameTime);

                // manually update the camera so position and rotation are correct
                scene.camera.onUpdate(0);

                // if the camera didn't move, don't sort
                const pos = scene.camera.entity.getPosition();
                const forward = scene.camera.entity.forward;
                if (last_pos.equals(pos) && last_forward.equals(forward)) {
                    return;
                }

                // update remembered position
                last_pos.copy(pos);
                last_forward.copy(forward);

                // wait for sorting to complete
                await Promise.all(splats.map((splat) => {
                    // create a promise for each splat that will resolve upon sorting complete
                    return new Promise<void>((resolve) => {
                        const { instance } = splat.entity.gsplat;

                        // listen for the sorter to complete
                        const handle = instance.sorter.on('updated', () => {
                            handle.off();
                            resolve();
                        });

                        // manually invoke sort because internally the engine sorts after render the
                        // scene call is made.
                        instance.sort(scene.camera.entity);

                        // in cases where the camera does not move between frames the sorter won't run
                        // and we need a timeout instead. this is a hack - the engine should allow us to
                        // know whether the sorter is running or not.
                        setTimeout(() => {
                            resolve();
                        }, 1000);
                    });
                }));
            };

            // capture the current video frame
            const captureFrame = async (frameTime: number) => {
                const { renderTarget } = scene.camera.entity.camera;
                const { workRenderTarget } = scene.camera;

                scene.dataProcessor.copyRt(renderTarget, workRenderTarget);

                // read the rendered frame
                await workRenderTarget.colorBuffer.read(0, 0, width, height, { renderTarget: workRenderTarget, data });

                // flip the buffer vertically
                for (let y = 0; y < height / 2; y++) {
                    const top = y * width * 4;
                    const bottom = (height - y - 1) * width * 4;
                    line.set(data.subarray(top, top + width * 4));
                    data.copyWithin(top, bottom, bottom + width * 4);
                    data.set(line, bottom);
                }

                // construct the video frame
                const videoFrame = new VideoFrame(data, {
                    format: 'RGBA',
                    codedWidth: width,
                    codedHeight: height,
                    timestamp: Math.floor(1e6 * frameTime),
                    duration: Math.floor(1e6 / frameRate)
                });
                encoder.encode(videoFrame);
                videoFrame.close();
            };

            const animFrameRate = events.invoke('timeline.frameRate');
            const duration = (endFrame - startFrame) / animFrameRate;

            for (let frameTime = 0; frameTime <= duration; frameTime += 1.0 / frameRate) {
                // special case the first frame
                await prepareFrame(startFrame + frameTime * animFrameRate);

                // render a frame
                scene.lockedRender = true;

                // wait for render to finish
                await postRender();

                // wait for capture
                await captureFrame(frameTime);

                events.fire('progressUpdate', {
                    text: localize('panel.render.rendering', { ellipsis: true }),
                    progress: 100 * frameTime / duration
                });
            }

            // Flush and finalize output
            await encoder.flush();
            await output.finalize();

            // Free resources
            encoder.close();

            // Download
            if (!fileStream) {
                downloadFile((output.target as BufferTarget).buffer, `${removeExtension(splats[0]?.name ?? 'supersplat')}.${fileExtension}`);
            }

            return true;
        } catch (error) {
            await events.invoke('showPopup', {
                type: 'error',
                header: localize('render.failed'),
                message: `'${error.message ?? error}'`
            });
        } finally {
            scene.camera.endOffscreenMode();
            scene.camera.renderOverlays = true;
            scene.gizmoLayer.enabled = true;
            scene.camera.entity.camera.clearColor.set(0, 0, 0, 0);
            scene.lockedRenderMode = false;
            scene.forceRender = true;       // camera likely moved, finish with normal render

            events.fire('progressEnd');
        }
    });
};

export { ImageSettings, ImageBuffers, PixelHit, VideoSettings, registerRenderEvents };

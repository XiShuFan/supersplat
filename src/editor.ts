import { MemoryFileSystem } from '@playcanvas/splat-transform';
import { Color, Mat4, path, Texture, Vec3, Vec4 } from 'playcanvas';

import { EditHistory } from './edit-history';
import { SelectAllOp, SelectNoneOp, SelectInvertOp, SelectOp, HideSelectionOp, UnhideAllOp, DeleteSelectionOp, ResetOp, MultiOp, AddSplatOp } from './edit-ops';
import { Element, ElementType } from './element';
import { Events } from './events';
import { MappedReadFileSystem } from './io';
import { Scene } from './scene';
import { Splat } from './splat';
import { serializePly } from './splat-serialize';
import { loadCameraPoseFromPositionAndRotation } from './file-handler';

const removeExtension = (filename: string) => {
    return filename.substring(0, filename.length - path.getExtension(filename).length);
};

// register for editor and scene events
const registerEditorEvents = (events: Events, editHistory: EditHistory, scene: Scene) => {
    const vec = new Vec3();
    const vec2 = new Vec3();
    const vec4 = new Vec4();
    const mat = new Mat4();
    const SH_C0 = 0.28209479177387814;

    const colmapCameras = [
        { position: new Vec3(0.2872204152438903,-0.06634912866520953,0.20065800795281258),
        rotation:[[0.867703552031471,0.4378878410515149,-0.2352547224843991],[-0.4174375616416254,0.89885805815048,0.1334169158264519],[0.2698822482540537,-0.017562174045131287,0.962733162470342]]},

        { position:new Vec3(0.2982442299572279,-0.05108951975033939,0.21910267563243252),
        rotation:[[0.8635147957244773,0.43604513331636235,-0.25339068506168444],[-0.42419964050618714,0.899728018910618,0.10268474561294953],[0.272757882671309,0.018818440378797027,0.9618986452544644]]},

        { position:new Vec3(0.35580926907492144,0.2112014996953126,0.4323353087032558),
        rotation:[[0.8456713702742934,0.3248008071742948,-0.4234906954790453],[-0.4328206632171131,0.8816321433098793,-0.18812505780763794],[0.3122598389013504,0.34238749910263266,0.8861515634853595]]},

        { position:new Vec3(0.4330297566940431,0.3981300359190275,0.47385206222780524),
        rotation:[[0.826496884988948,0.21081246703424847,-0.5219779716103922],[-0.4461262493724291,0.8107876426772843,-0.37893900314259227],[0.34332822302347166,0.5460599804277423,0.7641624362992459]]},

        { position:new Vec3(0.4178741372514861,0.5124919227404521,0.5468539012697073),
        rotation:[[0.8288263153891944,0.11225045978473719,-0.5481302520354872],[-0.4312221065408352,0.7523771117573168,-0.49797206400982247],[0.3565030627482129,0.6490982329215148,0.6719948290495328]]},

        { position:new Vec3(0.48023902142490454,0.22928373838817712,0.44979533586939946),
        rotation:[[0.7261597006916797,0.2759029109927752,-0.6297377809827538],[-0.5510104922378349,0.7813508497043249,-0.2930499737419341],[0.41119280944003495,0.5597932059002164,0.7194108979524629]]},

        { position:new Vec3(0.7112853643755421,-0.09901369597149318,0.5041570616422539),
        rotation:[[0.4518150813067972,0.4292246929404595,-0.7820673214461149],[-0.7006453610313434,0.7133867342161122,-0.013245584537075602],[0.5522311204278432,0.5539363956400035,0.6230531752718788]]},

        { position:new Vec3(0.7361612810008257,-0.08905134562429971,0.5524911299965937),
        rotation:[[0.3362762031780415,0.4430326012882272,-0.8310477900650164],[-0.7437824459566736,0.6662208622404582,0.05419811622453761],[0.5776729076760209,0.5998932212580562,0.5535540938569276]]},

        { position:new Vec3(0.7278651710880063,-0.03534257611770224,0.662019672983889),
        rotation:[[0.31654083028492896,0.4013297735740391,-0.8594977112276325],[-0.749537138422138,0.66115547400907,0.03267288346312503],[0.581374217598683,0.633883153294716,0.5100942727385465]]},

        { position:new Vec3(0.8570117206741017,0.1449621451378286,0.8473748873581389),
        rotation:[[0.31654916390917287,0.21598385110107066,-0.9236598956823634],[-0.7327577497449062,0.6740337935055434,-0.09351216712978173],[0.6023808654142205,0.7064201450100905,0.37162867449476716]]},

        { position:new Vec3(0.8979079576373074,0.13868808345130051,0.7602755220854506),
        rotation:[[0.30439887029276885,0.19258685178633947,-0.932872784619378],[-0.729508451531448,0.6768705423003016,-0.09830405948018843],[0.6125020382894041,0.7104622252344753,0.3465323644426347]]},

        { position:new Vec3(0.805558957752099,-0.053425054263746184,0.8042784645707636),
        rotation:[[0.12002241343858194,0.3178419138012863,-0.9405164209643091],[-0.7779575763889123,0.6186500377009693,0.10979134843729157],[0.616746811594083,0.7185044527932481,0.3215193955344025]]},

        { position:new Vec3(0.7957816572448186,-0.43721079798263274,0.7186724426755313),
        rotation:[[-0.2657784838267973,0.4595932188170486,-0.8474289768187735],[-0.794974968048217,0.3927597210915213,0.4623360267866292],[0.5453224713061667,0.7965637919874936,0.26097802126432024]]},

        { position:new Vec3(0.774790517556594,-0.48615894413450716,0.7417156947986535),
        rotation:[[-0.34258701587295914,0.46685174541756097,-0.8152812915526997],[-0.7705121912781795,0.35689700705326094,0.5281434364338184],[0.5375361379916325,0.8091192583031265,0.23744668074336034]]},

        { position:new Vec3(0.6738460446052614,-0.6561032933884521,0.7932550169876175),
        rotation:[[-0.5007357292856449,0.43671233949260485,-0.7473593927633931],[-0.7229212060757036,0.26387708020440015,0.6385560401005141],[0.4760763165951668,0.8600297780180031,0.18357592897621985]]},

        { position:new Vec3(0.6948545549913907,-0.5254651707378878,0.9992425755638973),
        rotation:[[-0.5095806486107816,0.3566183169494216,-0.7830395510940552],[-0.7021236156227613,0.35368832338960765,0.61800242579028],[0.49734293093019694,0.864712637767028,0.07015741685489453]]},

        { position:new Vec3(0.7213281829176501,-0.37862441449493095,1.1948637970845588),
        rotation:[[-0.5189561411731386,0.20784892887057255,-0.8291461549727164],[-0.6620838494964538,0.5157948337270245,0.5436917010001789],[0.5406750408282607,0.8311164252184327,-0.1300614776076737]]},

        { position:new Vec3(0.738698418585629,-0.3760986066510489,1.2293420955916845),
        rotation:[[-0.5228332407960302,0.20126899316676342,-0.8283333837944453],[-0.6467538148660048,0.539345834887561,0.53927318990073],[0.5552971324210023,0.8176777255001364,-0.1518164416192596]]},

        { position:new Vec3(0.6474545208783623,-0.5148707541028605,0.8699475140159898),
        rotation:[[-0.5630237137743093,0.4495770298464997,-0.6934585726358747],[-0.6753500089700328,0.23335248936543793,0.6996063043534769],[0.47634720856950713,0.8622221929069982,0.1722388659585454]]},

        { position:new Vec3(0.46254132205705606,-0.7106640799860338,0.7283472925656955),
        rotation:[[-0.859628501902377,0.30339444242429997,-0.41108472487204145],[-0.45243071964685655,-0.07821454047311877,0.8883630618043539],[0.23737161295509057,0.9496495658739736,0.2045004141767733]]},

        { position:new Vec3(0.3105741342381483,-0.8174706646733212,0.7509706891385974),
        rotation:[[-0.9588024487656364,0.1453997640846242,-0.24404256359322465],[-0.2675849073634754,-0.1738413563453601,0.9477222695364316],[0.09537390414729675,0.973980539553096,0.20558630056392738]]},

        { position:new Vec3(0.27438138947905616,-0.7395878492959097,0.9008215034634143),
        rotation:[[-0.96762197276292,0.07933338602443835,-0.23961204412193715],[-0.2474167675891164,-0.11034576289749326,0.9626051920316677],[0.04992655548051397,0.9907219723375817,0.1264013947129675]]},

        { position:new Vec3(0.27598365748910003,-0.6375522223426157,1.1195060061212532),
        rotation:[[-0.9577592905896016,0.07404291515192737,-0.2778754901122186],[-0.26767421836579164,0.12364021809055929,0.955543619775037],[0.1051078213624643,0.98956088402196,-0.09859818812794006]]},

        { position:new Vec3(0.31324112272425436,-0.6000660076556739,1.2619389210712182),
        rotation:[[-0.9597492766844115,0.018162399590637698,-0.2802703215555692],[-0.2602038691891194,0.3181051610949166,0.9116485358644469],[0.10571316078314845,0.947881444973942,-0.3005752716231828]]},

        { position:new Vec3(0.32162360903836207,-0.5704014166455273,1.2963920709946173),
        rotation:[[-0.947873140218647,0.024113575546311185,-0.3177342372587722],[-0.28510380449957434,0.38114831704539454,0.8794553889045948],[0.14231068375884454,0.9241993810254557,-0.35440538]]}

    ];
    let currentColmapCameraIndex = 0;

    const decodeColorChannel = (value: number) => {
        return Math.min(1, Math.max(0, 0.5 + value * SH_C0));
    };

    // get the list of selected splats (currently limited to just a single one)
    const selectedSplats = () => {
        const selected = events.invoke('selection') as Splat;
        return selected?.visible ? [selected] : [];
    };

    let lastExportCursor = 0;

    // add unsaved changes warning message.
    window.addEventListener('beforeunload', (e) => {
        if (!events.invoke('scene.dirty')) {
            // if the undo cursor matches last export, then we have no unsaved changes
            return undefined;
        }

        const msg = 'You have unsaved changes. Are you sure you want to leave?';
        e.returnValue = msg;
        return msg;
    });

    events.function('targetSize', () => {
        return scene.targetSize;
    });

    // TODO 获取目标相机
    events.function('targetCamera', () => {
        return scene.camera;
    });

    events.on('scene.clear', () => {
        scene.clear();
        editHistory.clear();
        lastExportCursor = 0;
    });

    // When a splat is removed from the scene, remove all edit operations that reference it
    events.on('scene.elementRemoved', (element: Element) => {
        if (element.type === ElementType.splat) {
            editHistory.removeForSplat(element as Splat);
        }
    });

    events.function('scene.dirty', () => {
        return editHistory.cursor !== lastExportCursor;
    });

    events.on('doc.saved', () => {
        lastExportCursor = editHistory.cursor;
    });

    // force render on some events

    [
        'camera.mode', 'camera.overlay', 'camera.splatSize', 'view.outlineSelection',
        'view.centersUseGaussianColor', 'view.bands', 'camera.bound', 'camera.showPoses',
        'selection.changed', 'tool.coordSpace'
    ].forEach((eventName) => {
        events.on(eventName, () => {
            scene.forceRender = true;
        });
    });

    // grid.visible

    const setGridVisible = (visible: boolean) => {
        if (visible !== scene.grid.visible) {
            scene.grid.visible = visible;
            events.fire('grid.visible', visible);
        }
    };

    events.function('grid.visible', () => {
        return scene.grid.visible;
    });

    events.on('grid.setVisible', (visible: boolean) => {
        setGridVisible(visible);
    });

    events.on('grid.toggleVisible', () => {
        setGridVisible(!scene.grid.visible);
    });

    setGridVisible(scene.config.show.grid);

    // camera.fov

    const setCameraFov = (fov: number) => {
        if (fov !== scene.camera.fov) {
            scene.camera.fov = fov;
            events.fire('camera.fov', scene.camera.fov);
        }
    };

    events.function('camera.fov', () => {
        return scene.camera.fov;
    });

    events.on('camera.setFov', (fov: number) => {
        setCameraFov(fov);
    });

    // camera.tonemapping

    events.function('camera.tonemapping', () => {
        return scene.camera.tonemapping;
    });

    events.on('camera.setTonemapping', (value: string) => {
        scene.camera.tonemapping = value;
    });

    // camera.bound

    let bound = scene.config.show.bound;

    const setBoundVisible = (visible: boolean) => {
        if (visible !== bound) {
            bound = visible;
            events.fire('camera.bound', bound);
        }
    };

    events.function('camera.bound', () => {
        return bound;
    });

    events.on('camera.setBound', (value: boolean) => {
        setBoundVisible(value);
    });

    events.on('camera.toggleBound', () => {
        setBoundVisible(!events.invoke('camera.bound'));
    });

    // camera.showPoses

    let showPoses = scene.config.show.cameraPoses;

    const setShowPoses = (visible: boolean) => {
        if (visible !== showPoses) {
            showPoses = visible;
            events.fire('camera.showPoses', showPoses);
        }
    };

    events.function('camera.showPoses', () => {
        return showPoses;
    });

    events.on('camera.setShowPoses', (value: boolean) => {
        setShowPoses(value);
    });

    events.on('camera.toggleShowPoses', () => {
        setShowPoses(!events.invoke('camera.showPoses'));
    });

    // camera.focus
    // TODO 相机聚焦
    events.on('camera.focus', () => {
        const splat = selectedSplats()[0];
        if (splat) {
            // use current bounds (caller should have awaited the operation that changed data)
            const bound = splat.numSelected > 0 ?
                splat.selectionBound :
                splat.localBound;
            vec.copy(bound.center);

            const worldTransform = splat.worldTransform;
            worldTransform.transformPoint(vec, vec);
            worldTransform.getScale(vec2);

            scene.camera.focus({
                focalPoint: vec,
                radius: bound.halfExtents.length() * vec2.x,
                speed: 1
            });
        }
    });

    events.on('camera.reset', () => {
        const { initialAzim, initialElev, initialZoom } = scene.config.controls;
        const x = Math.sin(initialAzim * Math.PI / 180) * Math.cos(initialElev * Math.PI / 180);
        const y = -Math.sin(initialElev * Math.PI / 180);
        const z = Math.cos(initialAzim * Math.PI / 180) * Math.cos(initialElev * Math.PI / 180);
        const zoom = initialZoom;

        scene.camera.setPose(new Vec3(x * zoom, y * zoom, z * zoom), new Vec3(0, 0, 0));
    });


    events.on('camera.nextColmap', (speed: number = 2) => {
        console.log("camera.nextColmap event");
        if (colmapCameras.length === 0) {
            console.warn("No colmap cameras available");
            return;
        }
        const camera = colmapCameras[currentColmapCameraIndex];
        currentColmapCameraIndex = (currentColmapCameraIndex + 1) % colmapCameras.length;
        const splat = selectedSplats()[0];
        const centers = splat.splatData.getCenters();
        const invCount = 3 / centers.length;
        let sumX = 0, sumY = 0, sumZ = 0;
        for (let i = 0; i < centers.length; i += 3) {
            sumX += centers[i];
            sumY += centers[i + 1];
            sumZ += centers[i + 2];
        }
        const meanCenter = new Vec3(
            - sumX * invCount,
            - sumY * invCount,
            sumZ * invCount
        );

        // 距离设置为点云对齐后相机位置与点云中心的距离
        const pose = loadCameraPoseFromPositionAndRotation(
            camera.position,
            camera.rotation,
            events,
            "custom_pose",
            0,
            meanCenter.distance(camera.position)
        );
        scene.camera.setPose(pose["position"], pose["target"], speed)
    });

    // handle camera align events
    events.on('camera.align', (axis: string) => {
        switch (axis) {
            case 'px': scene.camera.setAzimElev(90, 0); break;
            case 'py': scene.camera.setAzimElev(0, -90); break;
            case 'pz': scene.camera.setAzimElev(0, 0); break;
            case 'nx': scene.camera.setAzimElev(270, 0); break;
            case 'ny': scene.camera.setAzimElev(0, 90); break;
            case 'nz': scene.camera.setAzimElev(180, 0); break;
        }

        // switch to ortho mode
        scene.camera.ortho = true;
    });

    // returns true if the selected splat has selected gaussians
    events.function('selection.splats', () => {
        const splat = events.invoke('selection') as Splat;
        return splat?.numSelected > 0;
    });

    events.on('select.all', () => {
        selectedSplats().forEach((splat) => {
            events.fire('edit.add', new SelectAllOp(splat));
        });
    });

    events.on('select.none', () => {
        selectedSplats().forEach((splat) => {
            events.fire('edit.add', new SelectNoneOp(splat));
        });
    });

    events.on('select.invert', () => {
        selectedSplats().forEach((splat) => {
            events.fire('edit.add', new SelectInvertOp(splat));
        });
    });

    events.on('select.pred', (op, pred: (i: number) => boolean) => {
        selectedSplats().forEach((splat) => {
            events.fire('edit.add', new SelectOp(splat, op, pred));
        });
    });

    const intersectCenters = async (splat: Splat, op: 'add'|'remove'|'set', options: any) => {
        const data = await scene.dataProcessor.intersect(options, splat);
        const filter = (i: number) => data[i] === 255;
        events.fire('edit.add', new SelectOp(splat, op, filter));
    };

    events.on('select.bySphere', async (op: 'add'|'remove'|'set', sphere: number[]) => {
        for (const splat of selectedSplats()) {
            await intersectCenters(splat, op, {
                sphere: { x: sphere[0], y: sphere[1], z: sphere[2], radius: sphere[3] }
            });
        }
    });

    events.on('select.byBox', async (op: 'add'|'remove'|'set', box: number[]) => {
        for (const splat of selectedSplats()) {
            await intersectCenters(splat, op, {
                box: { x: box[0], y: box[1], z: box[2], lenx: box[3], leny: box[4], lenz: box[5] }
            });
        }
    });

    events.function('select.rect', async (op: 'add'|'remove'|'set', rect: any) => {
        const mode = events.invoke('camera.mode');

        for (const splat of selectedSplats()) {
            if (mode === 'centers') {
                await intersectCenters(splat, op, {
                    rect: { x1: rect.start.x, y1: rect.start.y, x2: rect.end.x, y2: rect.end.y }
                });
            } else if (mode === 'rings') {
                scene.camera.pickPrep(splat, op);
                const pick = await scene.camera.pickRect(
                    rect.start.x,
                    rect.start.y,
                    rect.end.x - rect.start.x,
                    rect.end.y - rect.start.y
                );

                const sortedIds = new Uint32Array(new Set(pick)).sort();
                events.fire('edit.add', new SelectOp(splat, op, sortedIds));
            }
        }
    });

    let maskTexture: Texture = null;

    events.function('select.byMask', async (op: 'add'|'remove'|'set', canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
        const mode = events.invoke('camera.mode');

        for (const splat of selectedSplats()) {
            if (mode === 'centers') {
                // create mask texture
                if (!maskTexture || maskTexture.width !== canvas.width || maskTexture.height !== canvas.height) {
                    if (maskTexture) {
                        maskTexture.destroy();
                    }
                    maskTexture = new Texture(scene.graphicsDevice);
                }
                maskTexture.setSource(canvas);

                await intersectCenters(splat, op, {
                    mask: maskTexture
                });
            } else if (mode === 'rings') {
                const mask = context.getImageData(0, 0, canvas.width, canvas.height);

                // calculate mask bound so we limit pixel operations
                let mx0 = mask.width - 1;
                let my0 = mask.height - 1;
                let mx1 = 0;
                let my1 = 0;
                for (let y = 0; y < mask.height; ++y) {
                    for (let x = 0; x < mask.width; ++x) {
                        if (mask.data[(y * mask.width + x) * 4 + 3] === 255) {
                            mx0 = Math.min(mx0, x);
                            my0 = Math.min(my0, y);
                            mx1 = Math.max(mx1, x);
                            my1 = Math.max(my1, y);
                        }
                    }
                }

                // Convert mask bounds to normalized coordinates
                const nx0 = mx0 / mask.width;
                const ny0 = my0 / mask.height;
                const nx1 = (mx1 + 1) / mask.width;
                const ny1 = (my1 + 1) / mask.height;
                const nw = nx1 - nx0;
                const nh = ny1 - ny0;

                scene.camera.pickPrep(splat, op);
                const pick = await scene.camera.pickRect(nx0, ny0, nw, nh);

                // Calculate actual pixel dimensions for iteration
                const { width, height } = scene.targetSize;

                // Convert normalized coordinates to render target pixels
                const px = Math.floor(nx0 * width);
                const py = Math.floor(ny0 * height);
                const pw = Math.max(1, Math.ceil((nx0 + nw) * width) - px);
                const ph = Math.max(1, Math.ceil((ny0 + nh) * height) - py);

                const selected = new Set<number>();
                for (let y = 0; y < ph; ++y) {
                    for (let x = 0; x < pw; ++x) {
                        const mx = Math.floor((nx0 + x / width) * mask.width);
                        const my = Math.floor((ny0 + y / height) * mask.height);
                        if (mask.data[(my * mask.width + mx) * 4] === 255) {
                            selected.add(pick[(ph - 1 - y) * pw + x]);
                        }
                    }
                }

                const sortedIds = new Uint32Array(selected).sort();
                events.fire('edit.add', new SelectOp(splat, op, sortedIds));
            }
        }
    });

    events.function('select.point', async (op: 'add'|'remove'|'set', point: { x: number, y: number }) => {
        const { width, height } = scene.targetSize;
        const mode = events.invoke('camera.mode');

        for (const splat of selectedSplats()) {
            const splatData = splat.splatData;

            if (mode === 'centers') {
                const x = splatData.getProp('x');
                const y = splatData.getProp('y');
                const z = splatData.getProp('z');

                const splatSize = events.invoke('camera.splatSize');
                const camera = scene.camera.camera;
                const sx = point.x * width;
                const sy = point.y * height;

                // calculate final matrix
                mat.mul2(camera.camera._viewProjMat, splat.worldTransform);

                const filter = (i: number) => {
                    vec4.set(x[i], y[i], z[i], 1.0);
                    mat.transformVec4(vec4, vec4);
                    const px = (vec4.x / vec4.w * 0.5 + 0.5) * width;
                    const py = (-vec4.y / vec4.w * 0.5 + 0.5) * height;
                    return Math.abs(px - sx) < splatSize && Math.abs(py - sy) < splatSize;
                };

                events.fire('edit.add', new SelectOp(splat, op, filter));
            } else if (mode === 'rings') {
                scene.camera.pickPrep(splat, op);

                // Use normalized coordinates with minimal size for single pixel pick
                const pickResult = await scene.camera.pickRect(
                    point.x,
                    point.y,
                    1 / width,
                    1 / height
                );
                const pickId = pickResult[0];
                events.fire('edit.add', new SelectOp(splat, op, new Uint32Array([pickId])));
            }
        }
    });

    // Eyedropper selection with SelectOp so undo/redo and selection state updates remain consistent.
    // Threshold acts as a per-channel absolute difference: 0 only matches identical colors while 1 matches everything.
    // TO DO:
    // -  alternative distance metrics such as HSV.
    // -  alternative UI for threshold, two handles for min/max?
    events.function('select.colorMatch', async (op: 'add'|'remove'|'set', point: { x: number, y: number }, threshold = 0) => {
        const splats = selectedSplats();
        const targetSize = scene.targetSize;
        if (!splats.length || !targetSize || !point) {
            return;
        }

        const { width, height } = targetSize;
        if (!width || !height) {
            return;
        }

        // Clamp normalized coordinates to valid range
        const nx = Math.max(0, Math.min(1, point.x));
        const ny = Math.max(0, Math.min(1, point.y));
        const colorThreshold = Math.min(1, Math.max(0, Number.isFinite(threshold) ? threshold : 0));

        for (const splat of splats) {
            scene.camera.pickPrep(splat, 'set');
            // Use normalized coordinates with minimal size for single pixel pick
            const pickBuffer = await scene.camera.pickRect(nx, ny, 1 / width, 1 / height);
            const pickId = pickBuffer?.[0];
            if (pickId === undefined || pickId === 0xffffffff) {
                continue;
            }

            const reds = splat.splatData.getProp('f_dc_0') as Float32Array;
            const greens = splat.splatData.getProp('f_dc_1') as Float32Array;
            const blues = splat.splatData.getProp('f_dc_2') as Float32Array;
            // validate pickId and color channels exist
            if (!reds || !greens || !blues || pickId < 0 || pickId >= reds.length) {
                continue;
            }
            // decode color channels for the reference pixel
            const reference = [
                decodeColorChannel(reds[pickId]),
                decodeColorChannel(greens[pickId]),
                decodeColorChannel(blues[pickId])
            ];
            // Check if a value is within the color threshold of the reference
            const withinThreshold = (value: number, ref: number) => Math.abs(value - ref) <= colorThreshold;

            // filter to select pixels within the color threshold
            const filter = (i: number) => {
                return withinThreshold(decodeColorChannel(reds[i]), reference[0]) &&
                    withinThreshold(decodeColorChannel(greens[i]), reference[1]) &&
                    withinThreshold(decodeColorChannel(blues[i]), reference[2]);
            };

            events.fire('edit.add', new SelectOp(splat, op, filter));
        }
    });

    events.on('select.hide', () => {
        selectedSplats().forEach((splat) => {
            events.fire('edit.add', new HideSelectionOp(splat));
        });
    });

    events.on('select.unhide', () => {
        selectedSplats().forEach((splat) => {
            events.fire('edit.add', new UnhideAllOp(splat));
        });
    });

    events.on('select.delete', () => {
        // Don't delete gaussians when measure tool is active (backspace deletes measure points instead)
        if (events.invoke('tool.active') === 'measure') {
            return;
        }
        selectedSplats().forEach((splat) => {
            editHistory.add(new DeleteSelectionOp(splat));
        });
    });

    const performSelectionFunc = async (func: 'duplicate' | 'separate') => {
        const splats = selectedSplats();

        const memFs = new MemoryFileSystem();

        await serializePly(splats, {
            maxSHBands: 3,
            selected: true
        }, memFs);

        const data = memFs.results.get('output.ply');

        if (data) {
            const splat = splats[0];

            // wrap PLY in a blob and load it
            const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
            const filename = `${removeExtension(splat.filename)}.ply`;
            const fileSystem = new MappedReadFileSystem();
            fileSystem.addFile(filename, blob);
            const copy = await scene.assetLoader.load(filename, fileSystem);

            if (func === 'separate') {
                editHistory.add(new MultiOp([
                    new DeleteSelectionOp(splat),
                    new AddSplatOp(scene, copy)
                ]));
            } else {
                editHistory.add(new AddSplatOp(scene, copy));
            }
        }
    };

    // duplicate the current selection
    events.on('select.duplicate', async () => {
        await performSelectionFunc('duplicate');
    });

    events.on('select.separate', async () => {
        await performSelectionFunc('separate');
    });

    events.on('scene.reset', () => {
        selectedSplats().forEach((splat) => {
            editHistory.add(new ResetOp(splat));
        });
    });

    // camera mode (visual: centers/rings)

    let activeMode = 'centers';

    const setCameraMode = (mode: string) => {
        if (mode !== activeMode) {
            activeMode = mode;
            events.fire('camera.mode', activeMode);
        }
    };

    events.function('camera.mode', () => {
        return activeMode;
    });

    events.on('camera.setMode', (mode: string) => {
        setCameraMode(mode);
    });

    events.on('camera.toggleMode', () => {
        setCameraMode(events.invoke('camera.mode') === 'centers' ? 'rings' : 'centers');
    });

    // camera control mode (orbit/fly)

    let controlMode: 'orbit' | 'fly' = 'orbit';

    const setControlMode = (mode: 'orbit' | 'fly') => {
        if (mode !== controlMode) {
            controlMode = mode;
            scene.camera.controlMode = mode;
            events.fire('camera.controlMode', controlMode);
        }
    };

    events.function('camera.controlMode', () => {
        return controlMode;
    });

    events.on('camera.setControlMode', (mode: 'orbit' | 'fly') => {
        setControlMode(mode);
    });

    events.on('camera.toggleControlMode', () => {
        setControlMode(controlMode === 'orbit' ? 'fly' : 'orbit');
    });

    // camera overlay

    let cameraOverlay = scene.config.camera.overlay;

    const setCameraOverlay = (enabled: boolean) => {
        // [关闭] 显示/隐藏 splat
        enabled = false;
        if (enabled !== cameraOverlay) {
            cameraOverlay = enabled;
            events.fire('camera.overlay', cameraOverlay);
        }
    };

    events.function('camera.overlay', () => {
        return cameraOverlay;
    });

    events.on('camera.setOverlay', (value: boolean) => {
        setCameraOverlay(value);
    });

    events.on('camera.toggleOverlay', () => {
        setCameraOverlay(!events.invoke('camera.overlay'));
    });

    // splat size

    let splatSize = 2;

    const setSplatSize = (value: number) => {
        if (value !== splatSize) {
            splatSize = value;
            events.fire('camera.splatSize', splatSize);
        }
    };

    events.function('camera.splatSize', () => {
        return splatSize;
    });

    events.on('camera.setSplatSize', (value: number) => {
        setSplatSize(value);
    });

    // camera fly speed

    const setFlySpeed = (value: number) => {
        if (value !== scene.camera.flySpeed) {
            scene.camera.flySpeed = value;
            events.fire('camera.flySpeed', value);
        }
    };

    events.function('camera.flySpeed', () => {
        return scene.camera.flySpeed;
    });

    events.on('camera.setFlySpeed', (value: number) => {
        setFlySpeed(value);
    });

    // outline selection

    let outlineSelection = false;

    const setOutlineSelection = (value: boolean) => {
        if (value !== outlineSelection) {
            outlineSelection = value;
            events.fire('view.outlineSelection', outlineSelection);
        }
    };

    events.function('view.outlineSelection', () => {
        return outlineSelection;
    });

    events.on('view.setOutlineSelection', (value: boolean) => {
        setOutlineSelection(value);
    });

    // view spherical harmonic bands

    let viewBands = scene.config.show.shBands;

    const setViewBands = (value: number) => {
        if (value !== viewBands) {
            viewBands = value;
            events.fire('view.bands', viewBands);
        }
    };

    events.function('view.bands', () => {
        return viewBands;
    });

    events.on('view.setBands', (value: number) => {
        setViewBands(value);
    });

    // centers gaussian color toggle
    let centersUseGaussianColor = false;
    events.function('view.centersUseGaussianColor', () => centersUseGaussianColor);
    events.on('view.setCentersUseGaussianColor', (value: boolean) => {
        centersUseGaussianColor = value;
        events.fire('view.centersUseGaussianColor', value);
    });

    events.function('camera.getPose', () => {
        const camera = scene.camera;
        const position = camera.position;
        const focalPoint = camera.focalPoint;
        return {
            position: { x: position.x, y: position.y, z: position.z },
            target: { x: focalPoint.x, y: focalPoint.y, z: focalPoint.z }
        };
    });

    events.on('camera.setPose', (pose: { position: Vec3, target: Vec3 }, speed = 1) => {
        scene.camera.setPose(pose.position, pose.target, speed);
    });

    // hack: fire events to initialize UI
    events.fire('camera.fov', scene.camera.fov);
    events.fire('camera.overlay', cameraOverlay);
    events.fire('view.bands', viewBands);

    // doc serialization
    events.function('docSerialize.view', () => {
        const packC = (c: Color) => [c.r, c.g, c.b, c.a];
        return {
            bgColor: packC(events.invoke('bgClr')),
            selectedColor: packC(events.invoke('selectedClr')),
            unselectedColor: packC(events.invoke('unselectedClr')),
            lockedColor: packC(events.invoke('lockedClr')),
            shBands: events.invoke('view.bands'),
            centersSize: events.invoke('camera.splatSize'),
            outlineSelection: events.invoke('view.outlineSelection'),
            showGrid: events.invoke('grid.visible'),
            showBound: events.invoke('camera.bound'),
            showCameraPoses: events.invoke('camera.showPoses'),
            flySpeed: events.invoke('camera.flySpeed')
        };
    });

    events.function('docDeserialize.view', (docView: any) => {
        events.fire('setBgClr', new Color(docView.bgColor));
        events.fire('setSelectedClr', new Color(docView.selectedColor));
        events.fire('setUnselectedClr', new Color(docView.unselectedColor));
        events.fire('setLockedClr', new Color(docView.lockedColor));
        events.fire('view.setBands', docView.shBands);
        events.fire('camera.setSplatSize', docView.centersSize);
        events.fire('view.setOutlineSelection', docView.outlineSelection);
        events.fire('grid.setVisible', docView.showGrid);
        events.fire('camera.setBound', docView.showBound);
        events.fire('camera.setShowPoses', docView.showCameraPoses ?? false);
        events.fire('camera.setFlySpeed', docView.flySpeed);
    });
};

export { registerEditorEvents };

import { Container, Element, Label } from '@playcanvas/pcui';

import { Events } from '../events';
import { localize } from './localization';
import { SplatList } from './splat-list';
import sceneImportSvg from './svg/import.svg';
import sceneNewSvg from './svg/new.svg';
import customizeSvg from './svg/customize.svg'
import { Tooltips } from './tooltips';
import { Transform } from './transform';

const createSvg = (svgString: string) => {
    const decodedStr = decodeURIComponent(svgString.substring('data:image/svg+xml,'.length));
    return new DOMParser().parseFromString(decodedStr, 'image/svg+xml').documentElement;
};

class ScenePanel extends Container {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        args = {
            ...args,
            id: 'scene-panel',
            class: 'panel'
        };

        super(args);

        // stop pointer events bubbling
        ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'dblclick'].forEach((eventName) => {
            this.dom.addEventListener(eventName, (event: Event) => event.stopPropagation());
        });

        const sceneHeader = new Container({
            class: 'panel-header'
        });

        const sceneIcon = new Label({
            text: '\uE344',
            class: 'panel-header-icon'
        });

        const sceneLabel = new Label({
            text: localize('panel.scene-manager'),
            class: 'panel-header-label'
        });

        // [关闭] 导入按钮
        // const sceneImport = new Container({
        //     class: 'panel-header-button'
        // });
        // sceneImport.dom.appendChild(createSvg(sceneImportSvg));

        // [关闭] 新建场景按钮
        // const sceneNew = new Container({
        //     class: 'panel-header-button'
        // });
        // sceneNew.dom.appendChild(createSvg(sceneNewSvg));

        // 选定视角定制
        const frameCustomize = new Container({
            class: 'panel-header-button'
        });
        frameCustomize.dom.appendChild(createSvg(customizeSvg));

        sceneHeader.append(sceneIcon);
        sceneHeader.append(sceneLabel);
        sceneHeader.append(frameCustomize);
        // sceneHeader.append(sceneImport);
        // sceneHeader.append(sceneNew);

        // sceneImport.on('click', async () => {
        //     console.log("scene panel import scene");
        //     await events.invoke('scene.import');
        // });

        // sceneNew.on('click', () => {
        //     events.invoke('doc.new');
        // });

        frameCustomize.on('click', () => {
            events.invoke('show.logoSettingsDialog');
        });

        // tooltips.register(sceneImport, 'Import Scene', 'top');
        // tooltips.register(sceneNew, 'New Scene', 'top');
        tooltips.register(frameCustomize, 'Current Frame Customization', 'top');

        const splatList = new SplatList(events);

        const splatListContainer = new Container({
            class: 'splat-list-container'
        });
        splatListContainer.append(splatList);

        const transformHeader = new Container({
            class: 'panel-header'
        });

        const transformIcon = new Label({
            text: '\uE111',
            class: 'panel-header-icon'
        });

        const transformLabel = new Label({
            text: localize('panel.scene-manager.transform'),
            class: 'panel-header-label'
        });

        transformHeader.append(transformIcon);
        transformHeader.append(transformLabel);

        this.append(sceneHeader);
        this.append(splatListContainer);
        // [关闭] 变换
        // this.append(transformHeader);
        // this.append(new Transform(events));
        this.append(new Element({
            class: 'panel-header',
            height: 20
        }));
    }
}

export { ScenePanel };

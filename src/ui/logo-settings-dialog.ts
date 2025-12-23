import { BooleanInput, Button, Container, Element, Label, NumericInput, SelectInput, VectorInput } from '@playcanvas/pcui';

import { Events } from '../events';
import { ImageSettings, ImageBuffers } from '../render';
import { localize } from './localization';
import sceneExport from './svg/export.svg';
import { Camera } from '../camera';

const createSvg = (svgString: string, args = {}) => {
    const decodedStr = decodeURIComponent(svgString.substring('data:image/svg+xml,'.length));
    return new Element({
        dom: new DOMParser().parseFromString(decodedStr, 'image/svg+xml').documentElement,
        ...args
    });
};

class LogoSettingsDialog extends Container {
    show: () => Promise<ImageBuffers | null>;
    hide: () => void;
    destroy: () => void;

    constructor(events: Events, args = {}) {
        args = {
            ...args,
            id: 'logo-settings-dialog',
            class: 'settings-dialog',
            hidden: true,
            tabIndex: -1
        };

        super(args);

        const dialog = new Container({
            id: 'dialog'
        });

        // header

        const headerIcon = createSvg(sceneExport, { id: 'icon' });
        const headerText = new Label({ id: 'text', text: localize('popup.render-image.header').toUpperCase() });
        const header = new Container({ id: 'header' });
        header.append(headerIcon);
        header.append(headerText);

        // preset

        const presetLabel = new Label({ class: 'label', text: localize('popup.render-image.preset') });
        const presetSelect = new SelectInput({
            class: 'select',
            defaultValue: 'viewport',
            options: [
                { v: 'viewport', t: localize('popup.render-image.resolution-current') },
                { v: 'HD', t: 'HD' },
                { v: 'QHD', t: 'QHD' },
                { v: '4K', t: '4K' },
                { v: 'custom', t: localize('popup.render-image.resolution-custom') }
            ]
        });
        const presetRow = new Container({ class: 'row' });
        presetRow.append(presetLabel);
        presetRow.append(presetSelect);

        // resolution

        const resolutionLabel = new Label({ class: 'label', text: localize('popup.render-image.resolution') });
        const resolutionValue = new VectorInput({
            class: 'vector-input',
            dimensions: 2,
            min: 320,
            max: 16000,
            precision: 0,
            value: [1024, 768]
        });
        const resolutionRow = new Container({ class: 'row', enabled: false });
        resolutionRow.append(resolutionLabel);
        resolutionRow.append(resolutionValue);

        // transparent background

        const transparentBgLabel = new Label({ class: 'label', text: localize('popup.render-image.transparent-bg') });
        // 默认透明背景
        const transparentBgBoolean = new BooleanInput({ class: 'boolean', value: true });
        const transparentBgRow = new Container({ class: 'row' });
        transparentBgRow.append(transparentBgLabel);
        transparentBgRow.append(transparentBgBoolean);

        // show debug overlays

        const showDebugLabel = new Label({ class: 'label', text: localize('popup.render-image.show-debug') });
        const showDebugBoolean = new BooleanInput({ class: 'boolean', value: false });
        const showDebugRow = new Container({ class: 'row' });
        showDebugRow.append(showDebugLabel);
        showDebugRow.append(showDebugBoolean);

        // content

        const content = new Container({ id: 'content' });
        content.append(presetRow);
        content.append(resolutionRow);
        content.append(transparentBgRow);
        content.append(showDebugRow);

        // 占位图片
        const placeholderUrl = new URL( '../../static/images/preview-placeholder.png', import.meta.url ).toString();

        // preview row (image + buttons)
        const previewRow = new Container({
            class: 'preview-row'
        });
        previewRow.dom.style.display = 'flex';
        previewRow.dom.style.flexDirection = 'row';
        previewRow.dom.style.flexWrap = 'nowrap';
        previewRow.dom.style.gap = '12px';
        previewRow.dom.style.marginTop = '12px';
        previewRow.dom.style.alignItems = 'center';

        // image preview
        const previewImage = new Element({
            dom: document.createElement('img') as HTMLImageElement,
            class: 'image'
        });
        previewImage.dom.style.display = 'block';
        previewImage.dom.style.width = '240px';     // ✅ 固定宽度
        previewImage.dom.style.height = 'auto';
        previewImage.dom.style.flexShrink = '0';
        previewImage.dom.style.border = '1px solid #333';
        (previewImage.dom as HTMLImageElement).src = placeholderUrl;

        // right-side actions
        const previewActions = new Container({
            class: 'preview-actions'
        });
        previewActions.dom.style.display = 'flex';
        previewActions.dom.style.flexDirection = 'column';
        previewActions.dom.style.gap = '8px';
        previewActions.dom.style.minWidth = '96px'; // ✅ 防止按钮被挤
        previewActions.dom.style.flexShrink = '0';

        const previewButton = new Button({
            class: 'button',
            text: 'Preview'
        });

        const downloadButton = new Button({
            class: 'button',
            text: 'Download'
        });

        previewActions.append(previewButton);
        previewActions.append(downloadButton);

        previewRow.append(previewImage);
        previewRow.append(previewActions);

        content.append(previewRow);


        // upload
        const uploadRow = new Container({
            class: 'upload-row'
        });
        uploadRow.dom.style.display = 'flex';
        uploadRow.dom.style.flexDirection = 'row';
        uploadRow.dom.style.flexWrap = 'nowrap';
        uploadRow.dom.style.gap = '12px';
        uploadRow.dom.style.marginTop = '12px';
        uploadRow.dom.style.alignItems = 'center';

        // upload image
        const uploadImage = new Element({
            dom: document.createElement('img') as HTMLImageElement,
            class: 'image'
        });
        uploadImage.dom.style.display = 'block';
        uploadImage.dom.style.width = '240px';     // ✅ 固定宽度
        uploadImage.dom.style.height = 'auto';
        uploadImage.dom.style.flexShrink = '0';
        uploadImage.dom.style.border = '1px solid #333';
        (uploadImage.dom as HTMLImageElement).src = placeholderUrl;

        // right-side actions
        const uploadActions = new Container({
            class: 'upload-actions'
        });
        uploadActions.dom.style.display = 'flex';
        uploadActions.dom.style.flexDirection = 'column';
        uploadActions.dom.style.gap = '8px';
        uploadActions.dom.style.minWidth = '96px'; // ✅ 防止按钮被挤
        uploadActions.dom.style.flexShrink = '0';

        const uploadButton = new Button({
            class: 'button',
            text: 'Upload'
        });

        uploadActions.append(uploadButton);

        uploadRow.append(uploadImage);
        uploadRow.append(uploadActions);

        content.append(uploadRow);


        // footer

        const footer = new Container({ id: 'footer' });

        const cancelButton = new Button({
            class: 'button',
            text: localize('panel.render.cancel')
        });

        const okButton = new Button({
            class: 'button',
            text: localize('panel.render.ok')
        });

        footer.append(cancelButton);
        footer.append(okButton);


        dialog.append(header);
        dialog.append(content);
        dialog.append(footer);

        this.append(dialog);

        // 渲染图片结果
        let previewImageUrl: string = null;
        let imageArrayBuffer: ArrayBuffer = null;
        let rgba: Uint8Array = null;
        // 上传图片结果
        let uploadRgba: Uint8Array = null;

        let targetSize: { width: number, height: number };

        // Handle custom resolution activation

        const updateResolution = () => {
            const widths: Record<string, number> = {
                'viewport': targetSize.width,
                'HD': 1920,
                'QHD': 2560,
                '4K': 3840
            };

            const heights: Record<string, number> = {
                'viewport': targetSize.height,
                'HD': 1080,
                'QHD': 1440,
                '4K': 2160
            };

            resolutionValue.value = [widths[presetSelect.value], heights[presetSelect.value]];
        };

        presetSelect.on('change', () => {
            resolutionRow.enabled = presetSelect.value === 'custom';

            if (presetSelect.value !== 'custom') {
                updateResolution();
            }
        });

        // handle key bindings for enter and escape

        let onCancel: () => void;
        let onOK: () => void;

        cancelButton.on('click', () => onCancel());
        okButton.on('click', () => onOK());

        // TODO 预览按钮点击事件
        previewButton.on('click', async () => {
            const [width, height] = resolutionValue.value;

            const imageSettings = {
                width,
                height,
                transparentBg: transparentBgBoolean.value,
                showDebug: showDebugBoolean.value
            };

            // 调用外部 await 方法
            const renderResult = await events.invoke("render.image.and.return", imageSettings);
            
            rgba = renderResult.rgba;
            imageArrayBuffer = renderResult.arrayBuffer;

            // ArrayBuffer -> Blob -> ObjectURL
            const blob = new Blob([imageArrayBuffer], { type: 'image/png' });
            previewImageUrl = URL.createObjectURL(blob);

            console.log("预览图片 URL:", previewImageUrl);

            // 显示到面板
            (previewImage.dom as HTMLImageElement).src = previewImageUrl;
        });

        // TODO 下载按钮点击事件
        downloadButton.on('click', async() => {
            await events.invoke("download.image", imageArrayBuffer);
        });

        // TODO 上传按钮点击事件
        uploadButton.on('click', async () => {
            const imported = await events.invoke('image.import');
            if (!imported) return;

            console.log("上传文件名:", imported.filename);

            // 显示到页面（uploadImage已经处理了）
            (uploadImage.dom as HTMLImageElement).src = URL.createObjectURL(imported.contents);

            // 获取 RGBA
            const bitmap = await createImageBitmap(imported.contents);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(bitmap, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            uploadRgba = new Uint8Array(imageData.data); // Uint8ClampedArray, 每4个值是 RGBA
            console.log(uploadRgba.length);

            bitmap.close?.(); // 释放 ImageBitmap
        });

        const keydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            }
        };

        // reset UI and configure for current state
        const reset = () => {
            updateResolution();
        };

        // function implementations

        this.show = () => {
            targetSize = events.invoke('targetSize');

            reset();

            this.hidden = false;
            document.addEventListener('keydown', keydown);
            this.dom.focus();

            return new Promise<ImageBuffers | null>((resolve) => {
                onCancel = () => {
                    resolve(null);
                };

                onOK = () => {
                    const [width, height] = resolutionValue.value;

                    const imageBuffers = {
                        width,
                        height,
                        buffer: imageArrayBuffer,
                        rgba: rgba,
                        url: previewImageUrl,
                        uploadRgba: uploadRgba
                    };

                    resolve(imageBuffers);
                };
            }).finally(() => {
                document.removeEventListener('keydown', keydown);
                this.hide();
            });
        };

        this.hide = () => {
            this.hidden = true;
        };

        this.destroy = () => {
            this.hide();
            super.destroy();
        };
    }
}

export { LogoSettingsDialog };

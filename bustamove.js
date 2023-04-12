'use strict';

const PALETTES = [
    // TITLE-SCREEN
    [0xdc830, 0x160],
    // MAIN-MENU
    [0xdc9c0, 0x00c],
    // WHITE SCREEN
    [0xdb1f0, 0x200],
    // IN-GAME
    [0xdc5f0, 0x120],
    [0xdb350, 0x0a0],
    [0xdc810, 0x020],
    [0xdc7f0, 0x020],
    [0xdca30, 0x020],
    [0xdcc50, 0x020],
    [0xdca50, 0x0e0],
];
const PALETTE_MULTIPLAYER_FIRST  = 0xdb350;
const PALETTE_MULTIPLAYER_LAST   = 0xdc550;
const PALETTE_MULTIPLAYER_DELTA  = 0x00200;
const PALETTE_MULTIPLAYER_LENGTH = 0xa0;

const SLIDERS = ['saturation', 'brightness', 'contrast'];

function convertRGB(R, G, B, sat, brt, con) {
    const b = brt / 100;
    const c = (con + 100) / 100;
    const s = (sat + 100) / 100;

    const lumR = 0.2125;
    const lumG = 0.7154;
    const lumB = 0.0721;

    const sr = (1 - s) * lumR;
    const sg = (1 - s) * lumG;
    const sb = (1 - s) * lumB;

    const t = (1 - c) / 2;

    const R1 = R*c*(sr+s) + G*c*sg     + B*c*sb     + t + b;
    const G1 = R*c*sr     + G*c*(sg+s) + B*c*sb     + t + b;
    const B1 = R*c*sr     + G*c*sg     + B*c*(sb+s) + t + b;

    return [R1, G1, B1];
}

function clamp(x, min, max) {
    if (x > max) {
        return max;
    }
    if (x < min) {
        return min;
    }
    return x;
}

function scaleToInt(x, max) {
    return clamp(Math.round(x*max), 0, max);
}

function scaleRGB(r, g, b, max) {
    return [r, g, b].map(x => scaleToInt(x, max));
}

function adjust(lo, hi, sat, brt, con) {
    let r = lo & 0x1f;
    let g = (lo >> 5) | ((hi & 0x3) << 3);
    let b = (hi >> 2) & 0x1f;

    r /= 31;
    g /= 31;
    b /= 31;

    [r, g, b] = convertRGB(r, g, b, sat, brt, con);
    [r, g, b] = scaleRGB(r, g, b, 31);

    return [r | ((g & 0x7) << 5), (g >> 3) | (b << 2)];
}

function downloadURL(url, filename) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style = 'display: none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function downloadBinary(data, filename) {
    const blob = new Blob([data], {type: 'application/octet-stream'});
    const url = window.URL.createObjectURL(blob);
    downloadURL(url, filename);
    setTimeout(function() { return window.URL.revokeObjectURL(url); }, 1000);
}

let bam = {
    activateUI() {
        document.getElementById('download-button')['disabled'] = false;
    },
    adjustPalette(offset, length) {
        for (let i = 0; i < length; i += 2) {
            const [lo, hi] = adjust(
                this.rom[offset+i+0],
                this.rom[offset+i+1],
                this.saturation,
                this.brightness,
                this.contrast
            );
            this.patchedRom[offset+i+0] = lo;
            this.patchedRom[offset+i+1] = hi;
        }
    },
    adjustEverything() {
        let lst = [];
        for (let x = PALETTE_MULTIPLAYER_FIRST; x <= PALETTE_MULTIPLAYER_LAST; x += PALETTE_MULTIPLAYER_DELTA) {
            lst.push([x, PALETTE_MULTIPLAYER_LENGTH]);
        }
        lst = lst.concat(PALETTES);
        for (const [offset, length] of lst) {
            this.adjustPalette(offset, length);
        }
    },
    loadPreview() {
        this.img = new Image();
        this.img.src = 'screenshot.png';
        this.canvas = document.getElementById('canvas');
        this.ctx = canvas.getContext('2d');
        this.img.addEventListener('load', () => {
            this.ctx.drawImage(this.img, 0, 0);
            this.originalImgData = this.ctx.getImageData(0, 0, this.img.width, this.img.height);
            this.adjustPreview();
        });
    },
    adjustPreview() {
        this.updateValues();
        let imgData = this.ctx.createImageData(this.img.width, this.img.height);
        for (let i = 0; i < imgData.data.length; i += 4) {
            let r = this.originalImgData.data[i+0] / 255;
            let g = this.originalImgData.data[i+1] / 255;
            let b = this.originalImgData.data[i+2] / 255;
            [r, g, b] = convertRGB(r, g, b, this.saturation, this.brightness, this.contrast);
            [r, g, b] = scaleRGB(r, g, b, 255);
            imgData.data[i+0] = r;
            imgData.data[i+1] = g;
            imgData.data[i+2] = b;
            imgData.data[i+3] = 255;
        }
        this.ctx.putImageData(imgData, 0, 0);
    },
    downloadROM(filename) {
        this.patchedRom = this.rom.slice();
        this.adjustEverything();
        downloadBinary(this.patchedRom, filename);
    },
    updateValues() {
        this.brightness = parseInt(document.getElementById('brightness').value);
        this.saturation = parseInt(document.getElementById('saturation').value);
        this.contrast = parseInt(document.getElementById('contrast').value);
    },
    handleDownloadButton() {
        this.updateValues();
        let filename = 'BustAMoveGBA' +
            '_sat' + this.saturation +
            '_con' + this.contrast +
            '_brt' + this.brightness +
            '.bin';
        this.downloadROM(filename);
    },
    handleResetButton() {
        for (const slider of SLIDERS) {
            const output = document.querySelector('#' + slider + '-out');
            const input = document.querySelector('#' + slider);
            input.value = 0;
            output.value = 0;
        }
        this.updateValues();
        this.adjustPreview();
    },
    init(rom) {
        this.rom = new Uint8Array(rom);
        this.activateUI();
    },
};

function handleFileSelect(evt) {
    const file = evt.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        bam.init(reader.result);
    }
    reader.readAsArrayBuffer(file);
}

for (const slider of SLIDERS) {
    const output = document.querySelector('#' + slider + '-out');
    const input = document.querySelector('#' + slider);
    output.textContent = input.value;
    input.addEventListener('input', (event) => {
        output.textContent = event.target.value;
        bam.adjustPreview();
    });
}
document.getElementById('file-selector').addEventListener('change',
    handleFileSelect, false
);
document.getElementById('download-button').addEventListener('click', (e) => {
    bam.handleDownloadButton();
});
document.getElementById('reset-button').addEventListener('click', (e) => {
    bam.handleResetButton();
});
bam.loadPreview();

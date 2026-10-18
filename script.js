const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

const fileInput = document.getElementById('file-input');
const previewWrapper = document.getElementById('preview-wrapper');
const player = document.getElementById('video-player');
const sliderBlur = document.getElementById('slider-blur');
const sliderBlend = document.getElementById('slider-blend');
const blurVal = document.getElementById('blur-val');
const blendVal = document.getElementById('blend-val');
const blurBtn = document.getElementById('blur-btn');
const exportBtn = document.getElementById('export-btn');
const progressWrapper = document.getElementById('progress-wrapper');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const statusDiv = document.getElementById('status');

let videoDuration = 0;
let finalVideoUrl = null;

// Sliders percentage tracking
sliderBlur.addEventListener('input', function() {
    blurVal.textContent = sliderBlur.value + '%';
});
sliderBlend.addEventListener('input', function() {
    blendVal.textContent = sliderBlend.value + '%';
});

// Video Upload Configuration
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0]; 
    if (file) {
        finalVideoUrl = null;
        exportBtn.style.display = 'none';
        blurBtn.style.display = 'block';
        blurBtn.disabled = false;
        
        const blobUrl = URL.createObjectURL(file);
        player.src = blobUrl;
        player.load();
        player.currentTime = 0;
        player.pause(); 
        
        previewWrapper.style.display = 'block'; 
        statusDiv.textContent = "Raw file loaded. Tap video window to preview.";
    }
});

// Play/Pause Video Click Controls
previewWrapper.addEventListener('click', function() {
    if (player.paused || player.ended) {
        player.play().catch(function(err) { console.log(err); });
    } else {
        player.pause();
    }
});

player.addEventListener('ended', function() {
    player.currentTime = 0;
    player.pause();
});

player.addEventListener('loadedmetadata', function() {
    videoDuration = player.duration;
});

// Progress Bar Tracking
ffmpeg.setLogger(function(logData) {
    const message = logData.message;
    if (message && message.includes('time=') && videoDuration > 0) {
        const timeMatch = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
            const hours = parseFloat(timeMatch[1]);
            const minutes = parseFloat(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = (hours * 3600) + (minutes * 60) + seconds;
            let progress = Math.min(Math.round((currentTime / videoDuration) * 100), 99);
            progressFill.style.width = progress + '%';
            progressLabel.textContent = 'Processing ' + progress + '%';
        }
    }
});

// Video Render Engine
blurBtn.addEventListener('click', async function() {
    if (!fileInput.files || !fileInput.files[0]) return;
    try {
        blurBtn.style.display = 'none';
        progressWrapper.style.display = 'block';
        progressFill.style.width = '0%';
        progressLabel.textContent = "Loading Engine...";
        if (!ffmpeg.isLoaded()) { await ffmpeg.load(); }

        progressLabel.textContent = "Processing 0%";
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(fileInput.files[0]));

        const sigmaValue = (parseInt(sliderBlur.value) / 100) * 8; 
        const frameMixCount = Math.max(1, Math.round((parseInt(sliderBlend.value) / 100) * 8)); 

        let filters = [];
        if (frameMixCount > 1) filters.push('tmix=frames=' + frameMixCount + ":weights='1'");
        if (sigmaValue > 0) filters.push('gblur=sigma=' + sigmaValue);
        const filterArgs = filters.join(',');

        if (filterArgs) {
            await ffmpeg.run('-i', 'input.mp4', '-vf', filterArgs, '-c:a', 'copy', 'output.mp4');
        } else {
            await ffmpeg.run('-i', 'input.mp4', '-c', 'copy', 'output.mp4');
        }

        progressFill.style.width = '100%';
        progressLabel.textContent = "Finished 100%";
        const data = ffmpeg.FS('readFile', 'output.mp4');
        finalVideoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        player.src = finalVideoUrl;
        player.currentTime = 0;
        player.pause();
        progressWrapper.style.display = 'none';
        exportBtn.style.display = 'block';
    } catch (error) {
        console.error(error);
        statusDiv.textContent = "⚠️ Render interrupted. Try using a shorter clip.";
        progressWrapper.style.display = 'none';
        blurBtn.style.display = 'block';
    }
});

exportBtn.addEventListener('click', function() {
    if (!finalVideoUrl) return;
    const dl = document.createElement('a');
    dl.href = finalVideoUrl;
    dl.download = 'free-motion-blur.mp4';
    dl.click();
});

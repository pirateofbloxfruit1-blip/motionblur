const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

const fileInput = document.getElementById('file-input');
const previewWrapper = document.getElementById('preview-wrapper');
const player = document.getElementById('video-player');
const sliderBlur = document.getElementById('slider-blur');
const sliderBlend = document.getElementById('slider-blend');
const blurVal = document.getElementById('blur-val');
const blendVal = document.getElementById('slider-val');
const blurBtn = document.getElementById('blur-btn');
const exportBtn = document.getElementById('export-btn');
const progressWrapper = document.getElementById('progress-wrapper');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const statusDiv = document.getElementById('status');

let videoDuration = 0;
let finalVideoUrl = null;

// Synchronize Sliders with Percentage Indicators
sliderBlur.addEventListener('input', () => blurVal.textContent = `${sliderBlur.value}%`);
sliderBlend.addEventListener('input', () => blendVal.textContent = `${sliderBlend.value}%`);

// Handle Video Upload & Unblurred Preview Configuration
fileInput.addEventListener('change', (e) => {
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
        player.pause(); // Initially paused on first frame
        
        previewWrapper.style.display = 'block'; // Container auto-adjusts to video bounds
        statusDiv.textContent = "Raw file loaded. Tap video window to preview.";
    }
});

// Custom Click-to-Toggle Video Controls
previewWrapper.addEventListener('click', () => {
    if (player.paused || player.ended) {
        player.play().catch(err => console.log("Playback interrupted"));
    } else {
        player.pause();
    }
});

// Automatically Reset and Pause at Finish
player.addEventListener('ended', () => {
    player.currentTime = 0;
    player.pause();
});

// Capture Video Metadata to calculate precise rendering progress percentages
player.addEventListener('loadedmetadata', () => {
    videoDuration = player.duration;
});

// Capture Processing Engine Console Prints to track timelines
ffmpeg.setLogger(({ message }) => {
    if (message.includes('time=') && videoDuration > 0) {
        const timeMatch = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
            const hours = parseFloat(timeMatch[1]);
            const minutes = parseFloat(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = (hours * 3600) + (minutes * 60) + seconds;
            
            // Calculate progress percentage
            let progress = Math.min(Math.round((currentTime / videoDuration) * 100), 99);
            progressFill.style.width = `${progress}%`;
            progressLabel.textContent = `Processing ${progress}%`;
        }
    }
});

// Convert Percentage Values to FFmpeg Filters
blurBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    try {
        // Swap processing button with the loading progress bar component
        blurBtn.style.display = 'none';
        progressWrapper.style.display = 'block';
        progressFill.style.width = '0%';
        progressLabel.textContent = "Loading WebAssembly Engine...";
        statusDiv.textContent = "Initializing libraries...";

        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }

        progressLabel.textContent = "Processing 0%";
        statusDiv.textContent = "Applying motion blur equations. Please wait...";
        
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));

        // Mathematical conversion from percentage values to engine filters
        const rawBlur = parseInt(sliderBlur.value); // Range 20 - 100
        const rawBlend = parseInt(sliderBlend.value); // Range 0 - 100
        
        const sigmaValue = (rawBlur / 100) * 8; 
        const frameMixCount = Math.max(1, Math.round((rawBlend / 100) * 8)); 

        let filters = [];
        if (frameMixCount > 1) filters.push(`tmix=frames=${frameMixCount}:weights='1'`);
        if (sigmaValue > 0) filters.push(`gblur=sigma=${sigmaValue}`);

        const filterArgs = filters.join(',');

        if (filterArgs) {
            await ffmpeg.run('-i', 'input.mp4', '-vf', filterArgs, '-c:a', 'copy', 'output.mp4');
        } else {
            await ffmpeg.run('-i', 'input.mp4', '-c', 'copy', 'output.mp4');
        }

        // Processing Complete Configuration
        progressFill.style.width = '100%';
        progressLabel.textContent = "Finished 100%";
        
        const data = ffmpeg.FS('readFile', 'output.mp4');
        finalVideoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        // Load the new processed video track into the preview box
        player.src = finalVideoUrl;
        player.currentTime = 0;
        player.pause();

        // Swap the loading component with the export action item
        progressWrapper.style.display = 'none';
        exportBtn.style.display = 'block';
        statusDiv.textContent = "Render completed. Click preview to evaluate or Export to save.";

    } catch (error) {
        console.error(error);
        statusDiv.textContent = "⚠️ Render interrupted. Try using a shorter clip.";
        progressWrapper.style.display = 'none';
        blurBtn.style.display = 'block';
    }
});

// Download Target Video Blob
exportBtn.addEventListener('click', () => {
    if (!finalVideoUrl) return;
    const dl = document.createElement('a');
    dl.href = finalVideoUrl;
    dl.download = 'free-motion-blur.mp4';
    dl.click();
});

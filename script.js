// Keep track of files globally without crashing on load
let ffmpegInstance = null;
let videoDuration = 0;
let finalVideoUrl = null;

// Grab layout elements safely
const fileInput = document.getElementById('file-input');
const previewWrapper = document.getElementById('preview-wrapper');
const player = document.getElementById('video-player');
const sliderBlur = document.getElementById('slider-blur');
const sliderBlend = document.getElementById('slider-blend');
const blurVal = document.getElementById('blur-val');
const blendVal = document.getElementById('blend-val') || document.getElementById('slider-val');
const blurBtn = document.getElementById('blur-btn');
const exportBtn = document.getElementById('export-btn');
const progressWrapper = document.getElementById('progress-wrapper');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const statusDiv = document.getElementById('status');

// 1. Sliders percentage tracking
if (sliderBlur && blurVal) {
    sliderBlur.addEventListener('input', function() {
        blurVal.textContent = sliderBlur.value + '%';
    });
}
if (sliderBlend && blendVal) {
    sliderBlend.addEventListener('input', function() {
        blendVal.textContent = sliderBlend.value + '%';
    });
}

// 2. Video Upload Configuration
if (fileInput) {
    fileInput.addEventListener('change', function(e) {
        const selectedFiles = e.target.files; 
        if (selectedFiles && selectedFiles.length > 0) {
            finalVideoUrl = null;
            if (exportBtn) exportBtn.style.display = 'none';
            if (blurBtn) {
                blurBtn.style.display = 'block';
                blurBtn.disabled = false;
            }
            
            const blobUrl = URL.createObjectURL(selectedFiles[0]);
            if (player) {
                player.src = blobUrl;
                player.load();
                player.currentTime = 0;
                player.pause(); 
            }
            
            if (previewWrapper) previewWrapper.style.display = 'block'; 
            if (statusDiv) statusDiv.textContent = "Raw file loaded. Tap video window to preview.";
        }
    });
}

// 3. Play/Pause Video Click Controls
if (previewWrapper && player) {
    previewWrapper.addEventListener('click', function() {
        if (player.paused || player.ended) {
            player.play().catch(function(err) { console.log("Playback error:", err); });
        } else {
            player.pause();
        }
    });
}

if (player) {
    player.addEventListener('ended', function() {
        player.currentTime = 0;
        player.pause();
    });

    player.addEventListener('loadedmetadata', function() {
        videoDuration = player.duration;
    });
}

// 4. Video Render Engine (With Direct Core Optimization Maps)
if (blurBtn) {
    blurBtn.addEventListener('click', async function() {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
        
        try {
            blurBtn.style.display = 'none';
            if (progressWrapper) progressWrapper.style.display = 'block';
            if (progressFill) progressFill.style.width = '0%';
            if (progressLabel) progressLabel.textContent = "Loading Engine...";
            if (statusDiv) statusDiv.textContent = "Initializing libraries...";

            if (typeof FFmpeg === 'undefined') {
                alert("The video processing library hasn't finished downloading yet. Please wait 5 seconds and try again.");
                blurBtn.style.display = 'block';
                if (progressWrapper) progressWrapper.style.display = 'none';
                return;
            }

            // FIXED: Added direct corePath parameters so initialization doesn't hang in an infinite loop
            if (!ffmpegInstance) {
                ffmpegInstance = FFmpeg.createFFmpeg({ 
                    corePath: 'https://unpkg.com',
                    log: true 
                });
                
                ffmpegInstance.setLogger(function(logData) {
                    const message = logData.message;
                    if (message && message.includes('time=') && videoDuration > 0) {
                        const timeMatch = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                        if (timeMatch) {
                            const hours = parseFloat(timeMatch[1]);
                            const minutes = parseFloat(timeMatch[2]);
                            const seconds = parseFloat(timeMatch[3]);
                            const currentTime = (hours * 3600) + (minutes * 60) + seconds;
                            let progress = Math.min(Math.round((currentTime / videoDuration) * 100), 99);
                            if (progressFill) progressFill.style.width = progress + '%';
                            if (progressLabel) progressLabel.textContent = 'Processing ' + progress + '%';
                        }
                    }
                });
            }

            if (!ffmpegInstance.isLoaded()) { 
                await ffmpegInstance.load(); 
            }

            if (progressLabel) progressLabel.textContent = "Processing 0%";
            ffmpegInstance.FS('writeFile', 'input.mp4', await FFmpeg.fetchFile(fileInput.files[0]));

            const sigmaValue = (parseInt(sliderBlur.value) / 100) * 8; 
            const frameMixCount = Math.max(1, Math.round((parseInt(sliderBlend.value) / 100) * 8)); 

            let filters = [];
            if (frameMixCount > 1) filters.push('tmix=frames=' + frameMixCount + ":weights='1'");
            if (sigmaValue > 0) filters.push('gblur=sigma=' + sigmaValue);
            const filterArgs = filters.join(',');

            if (filterArgs) {
                await ffmpegInstance.run('-i', 'input.mp4', '-vf', filterArgs, '-c:a', 'copy', 'output.mp4');
            } else {
                await ffmpegInstance.run('-i', 'input.mp4', '-c', 'copy', 'output.mp4');
            }

            if (progressFill) progressFill.style.width = '100%';
            if (progressLabel) progressLabel.textContent = "Finished 100%";
            
            const data = ffmpegInstance.FS('readFile', 'output.mp4');
            finalVideoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
            
            if (player) {
                player.src = finalVideoUrl;
                player.currentTime = 0;
                player.pause();
            }
            
            if (progressWrapper) progressWrapper.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'block';
            if (statusDiv) statusDiv.textContent = "Render completed! Click Export to save.";
            
        } catch (error) {
            console.error(error);
            if (statusDiv) statusDiv.textContent = "⚠️ Render interrupted. Try using a shorter clip.";
            if (progressWrapper) progressWrapper.style.display = 'none';
            blurBtn.style.display = 'block';
        }
    });
}

if (exportBtn) {
    exportBtn.addEventListener('click', function() {
        if (!finalVideoUrl) return;
        const dl = document.createElement('a');
        dl.href = finalVideoUrl;
        dl.download = 'free-motion-blur.mp4';
        dl.click();
    });
}

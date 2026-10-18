let selectedFileBlob = null;
let finalVideoUrl = null;

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

// Sliders percentage tracking
sliderBlur.addEventListener('input', function() { blurVal.textContent = sliderBlur.value + '%'; });
sliderBlend.addEventListener('input', function() { blendVal.textContent = sliderBlend.value + '%'; });

// Video Upload Configuration
fileInput.addEventListener('change', function(e) {
    const files = e.target.files; 
    if (files && files.length > 0) {
        selectedFileBlob = files[0]; // FIXED: Targeting the specific first file index
        finalVideoUrl = null;
        if (exportBtn) exportBtn.style.display = 'none';
        if (blurBtn) {
            blurBtn.style.display = 'block';
            blurBtn.disabled = false;
        }
        
        const blobUrl = URL.createObjectURL(selectedFileBlob);
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

// Video Render Engine
blurBtn.addEventListener('click', function() {
    if (!selectedFileBlob) return;
    
    blurBtn.style.display = 'none';
    progressWrapper.style.display = 'block';
    progressFill.style.width = '25%';
    progressLabel.textContent = "Reading file...";
    statusDiv.textContent = "Processing frame mixing scripts...";

    const reader = new FileReader();
    reader.onload = function() {
        progressFill.style.width = '50%';
        progressLabel.textContent = "Applying effects...";
        
        const u8array = new Uint8Array(reader.result);
        
        const sigmaValue = (parseInt(sliderBlur.value) / 100) * 8; 
        const frameMixCount = Math.max(1, Math.round((parseInt(sliderBlend.value) / 100) * 8)); 

        let filters = [];
        if (frameMixCount > 1) filters.push('tmix=frames=' + frameMixCount + ":weights='1'");
        if (sigmaValue > 0) filters.push('gblur=sigma=' + sigmaValue);
        const filterArgs = filters.join(',');

        // Execute inside standalone web assembler space
        try {
            // Check if library loaded safely
            if (typeof ffmpeg === 'undefined') {
                alert("The processing library is still loading from the web. Please wait 5 seconds and click again.");
                blurBtn.style.display = 'block';
                progressWrapper.style.display = 'none';
                return;
            }

            const result = ffmpeg({
                arguments: ['-i', 'input.mp4', '-vf', filterArgs, '-c:a', 'copy', 'output.mp4'],
                MEMFS: [{ name: 'input.mp4', data: u8array }]
            });

            const outVideo = result.MEMFS && result.MEMFS[0]; // FIXED: Targeting individual file arrays inside MEMFS
            if (outVideo && outVideo.data) {
                progressFill.style.width = '100%';
                progressLabel.textContent = "Finished 100%";
                
                finalVideoUrl = URL.createObjectURL(new Blob([outVideo.data.buffer], { type: 'video/mp4' }));
                player.src = finalVideoUrl;
                player.currentTime = 0;
                player.pause();
                
                progressWrapper.style.display = 'none';
                exportBtn.style.display = 'block';
                statusDiv.textContent = "Render completed! Click Export to save.";
            } else {
                throw new Error("Render returned empty track data bounds.");
            }
        } catch (err) {
            console.error(err);
            statusDiv.textContent = "⚠️ Processing error. Try turning down the Blur / Blend sliders slightly.";
            progressWrapper.style.display = 'none';
            blurBtn.style.display = 'block';
        }
    };
    reader.readAsArrayBuffer(selectedFileBlob);
});

exportBtn.addEventListener('click', function() {
    if (!finalVideoUrl) return;
    const dl = document.createElement('a');
    dl.href = finalVideoUrl;
    dl.download = 'free-motion-blur.mp4';
    dl.click();
});

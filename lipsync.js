const PHONEME_MAP = {
    // Vowels
    'i': 'E', 'ɪ': 'E', 'e': 'E', 'ɛ': 'E', 'eɪ': 'E', 'ɪə': 'E',
    'u': 'O', 'ʊ': 'O', 'uː': 'O', 'ʊə': 'O', 'o': 'O', 'ɔ': 'O',
    'ɔː': 'O', 'oʊ': 'O', 'ɔɪ': 'O', 'w': 'O', 'r': 'O', 'ɹ': 'O',
    'æ': 'A', 'a': 'A', 'ɑ': 'A', 'ɑː': 'A', 'ʌ': 'A', 'ə': 'A',
    'ɜ': 'A', 'ɜː': 'A', 'aɪ': 'A', 'aʊ': 'A',
    // Consonants
    'f': 'FV', 'v': 'FV',
    't': 'TS', 's': 'TS', 'z': 'TS', 'd': 'TS', 'n': 'TS',
    'ʃ': 'TS', 'ʒ': 'TS', 'tʃ': 'TS', 'dʒ': 'TS',
    'l': 'LN', 'ð': 'LN', 'θ': 'LN',
    // Bilabials
    'p': 'MBP', 'b': 'MBP', 'm': 'MBP'
};

const VOWELS = new Set(['E', 'O', 'A']);
const VISEMES = ['MBP', 'E', 'O', 'A', 'FV', 'TS', 'LN'];


class LipSyncApp {
    constructor() {
        this.audioFile = null;
        this.audioDuration = 0;
        this.animationId = null;
        this.audioElement = null;
        this.imageCache = new Map();
        this.charactersConfig = {
            characters: [
                { id: "diego", name: "Diego" },
                { id: "ted", name: "Ted" }
            ]
        };
        this.selectedCharacter = '';
        this.selectedAngle = '';
        this.canvas = null;
        this.ctx = null;
        this.timeline = [];
        this.msPerFrame = 0;
        this.apiKey = localStorage.getItem('gemini_api_key') || '';

        this.bindElements();
        this.bindEvents();
        this.initCanvas();
        this.initAngleSlider();
        this.populateCharacterDropdown();
        this.preloadImages().then(() => this.updatePreview());
    }

    bindElements() {
        const elementIds = [
            'audio-file', 'text-input', 'preview-btn',
            'stop-btn', 'duration-info', 'duration-display', 'render-canvas',
            'audio-error', 'framerate-select', 'framerate-value', 'character-select',
            'angle-select', 'angle-value', 'export-btn', 'export-progress', 'export-status'
        ];

        elementIds.forEach(id => {
            const camelCase = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            this[camelCase] = document.getElementById(id);
        });
    }

    bindEvents() {
        // Main app events
        this.audioFile.onchange = e => this.handleAudioFile(e);
        this.textInput.oninput = () => this.updateUI();
        this.previewBtn.onclick = () => this.startAnimation();
        this.stopBtn.onclick = () => this.stopAnimation();
        this.exportBtn.onclick = () => this.exportVideo();
        this.characterSelect.onchange = () => this.handleCharacterChange();
        this.angleSelect.oninput = () => this.handleAngleChange();
        this.framerateSelect.oninput = () => this.updateFramerateDisplay();
    }

    initCanvas() {
        this.canvas = this.renderCanvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.clearRect(0, 0, 1080, 1080);
    }

    initAngleSlider() {
        // Set initial angle to 180° (index 2 in the angles array)
        this.angleSelect.value = 2;
        this.handleAngleChange();
    }


    populateCharacterDropdown() {
        this.characterSelect.innerHTML = '';

        this.charactersConfig.characters.forEach((character, index) => {
            const option = document.createElement('option');
            option.value = character.id;
            option.textContent = character.name;
            if (index === 0) {
                option.selected = true;
                this.selectedCharacter = character.id;
            }
            this.characterSelect.appendChild(option);
        });
    }

    handleCharacterChange() {
        const selectedCharacterId = this.characterSelect.value;
        this.selectedCharacter = selectedCharacterId;

        this.imageCache.clear();
        if (this.selectedCharacter && this.selectedAngle !== undefined && this.selectedAngle !== '') {
            this.preloadImages().then(() => this.updatePreview());
        }
        this.updateUI();
    }

    handleAngleChange() {
        const angles = [90, 135, 180, 225, 270, 0];
        const sliderIndex = parseInt(this.angleSelect.value);
        this.selectedAngle = angles[sliderIndex];

        this.angleValue.textContent = this.selectedAngle === 0 ? '0°' : this.selectedAngle + '°';

        this.imageCache.clear();
        if (this.selectedCharacter && this.selectedAngle !== undefined) {
            this.preloadImages().then(() => this.updatePreview());
        }

        this.updateUI();
    }

    async preloadImages() {
        if (!this.selectedCharacter || !this.selectedAngle) return;

        const loadPromises = VISEMES.map(async viseme => {
            const img = new Image();
            img.src = `${this.selectedCharacter}/${this.selectedAngle}/${viseme.toLowerCase()}.svg`;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            this.imageCache.set(viseme, img);
        });

        try {
            await Promise.all(loadPromises);
        } catch (error) {
        }
    }

    handleAudioFile(e) {
        this.clearAudioError();
        const file = e.target.files[0];

        if (!file) {
            this.resetAudio();
            return;
        }

        this.audioFile = file;
        const audio = new Audio(URL.createObjectURL(file));

        audio.onloadedmetadata = () => {
            this.audioDuration = audio.duration;
            this.durationDisplay.textContent = audio.duration.toFixed(2);
            this.durationInfo.style.display = 'block';
            this.updateUI();
        };

        audio.onerror = () => {
            this.showAudioError('Error loading audio file');
            this.resetAudio();
        };
    }

    resetAudio() {
        this.audioFile = null;
        this.audioDuration = 0;
        this.durationInfo.style.display = 'none';
        this.updateUI();
    }

    updateUI() {
        const hasApiKey = this.apiKey;
        const hasText = this.textInput.value.trim();
        const hasAudio = this.audioFile;
        const hasCharacter = this.selectedCharacter;
        const hasAngle = this.selectedAngle;

        this.previewBtn.disabled = !hasApiKey || !hasAudio || !hasText || !hasCharacter || !hasAngle;
        this.exportBtn.disabled = !hasApiKey || !hasAudio || !hasText || !hasCharacter || !hasAngle;

        // Always update preview when not animating
        if (!this.animationId) {
            this.updatePreview();
        }
    }

    updateFramerateDisplay() {
        this.framerateValue.textContent = this.framerateSelect.value;
    }

    updatePreview() {
        const hasCharacter = this.selectedCharacter;
        const hasAngle = this.selectedAngle;

        if (hasCharacter && hasAngle) {
            this.displayViseme('MBP');
        }
    }

    showAudioError(message) {
        this.audioError.textContent = message;
    }

    clearAudioError() {
        this.audioError.textContent = '';
    }

    async convertTextToIPA(text) {
        const apiKey = this.apiKey;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Convert this text to IPA (International Phonetic Alphabet) notation with standard British pronunciation. When there are two or more sentences, use dots (.) to seperate them. Do not place a dot at the end. Return only the IPA transcription, nothing else: "${text}"`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.candidates?.[0]?.content) {
                return data.candidates[0].content.parts[0].text.trim();
            } else {
                throw new Error('Invalid response format from Gemini API');
            }

        } catch (error) {
            throw error;
        }
    }

    parsePhonetics(phonetic) {
        const segments = [];
        let i = 0;

        while (i < phonetic.length) {
            if (phonetic[i] === '.') {
                segments.push({ type: 'pause', duration: 500 });
                i++;
                continue;
            }

            let matched = false;
            for (let len = 3; len >= 1; len--) {
                const substr = phonetic.substring(i, i + len);
                if (PHONEME_MAP[substr]) {
                    segments.push({
                        type: 'phoneme',
                        phoneme: substr,
                        viseme: PHONEME_MAP[substr]
                    });
                    i += len;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                segments.push({
                    type: 'phoneme',
                    phoneme: phonetic[i],
                    viseme: 'MBP'
                });
                i++;
            }
        }

        return segments;
    }

    generateTimeline(segments, duration, fps) {
        const msPerFrame = 1000 / fps;
        const totalFrames = Math.round(duration * 1000 / msPerFrame);
        const timeline = new Array(totalFrames).fill('MBP');

        const pauseDuration = segments
            .filter(s => s.type === 'pause')
            .reduce((sum, s) => sum + s.duration, 0);

        const phonemes = segments.filter(s => s.type === 'phoneme');
        const availableTime = (duration * 1000) - pauseDuration;

        if (phonemes.length > 0) {
            const baseTime = availableTime / phonemes.length;

            phonemes.forEach(s => {
                const isVowel = VOWELS.has(s.viseme);
                s.duration = baseTime * (isVowel ? 1.3 : 0.8);
            });

            const totalPhonemeTime = phonemes.reduce((sum, s) => sum + s.duration, 0);
            const scale = availableTime / totalPhonemeTime;
            phonemes.forEach(s => s.duration *= scale);
        }

        let currentTime = 0;
        segments.forEach(segment => {
            const startFrame = Math.round(currentTime / msPerFrame);
            const endFrame = Math.round((currentTime + segment.duration) / msPerFrame);
            const viseme = segment.type === 'pause' ? 'MBP' : segment.viseme;

            for (let f = startFrame; f < endFrame && f < totalFrames; f++) {
                timeline[f] = viseme;
            }

            currentTime += segment.duration;
        });

        return { timeline, msPerFrame };
    }

    displayViseme(viseme) {
        this.ctx.clearRect(0, 0, 1080, 1080);

        if (!this.selectedCharacter || !this.selectedAngle) {
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('Select character and angle', 540, 540);
            return;
        }

        const img = this.imageCache.get(viseme);
        if (img && img.complete && img.naturalHeight !== 0) {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            let drawWidth = 800;
            let drawHeight = drawWidth / aspectRatio;

            if (drawHeight > 800) {
                drawHeight = 800;
                drawWidth = drawHeight * aspectRatio;
            }

            const x = (1080 - drawWidth) / 2;
            const y = (1080 - drawHeight) / 2;

            this.ctx.drawImage(img, x, y, drawWidth, drawHeight);
        } else {
            this.ctx.font = '72px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(viseme, 540, 540);
        }
    }

    async startAnimation() {
        this.stopAnimation();

        const text = this.textInput.value.trim();
        if (!text) return;

        // Convert text to IPA on-demand
        const ipaPhonetics = await this.convertTextToIPA(text);
        if (!ipaPhonetics) return;

        const fps = parseInt(this.framerateSelect.value);

        const segments = this.parsePhonetics(ipaPhonetics);
        const { timeline, msPerFrame } = this.generateTimeline(segments, this.audioDuration, fps);

        this.timeline = timeline;
        this.msPerFrame = msPerFrame;

        this.audioElement = new Audio(URL.createObjectURL(this.audioFile));
        this.audioElement.play();

        this.previewBtn.style.display = 'none';
        this.stopBtn.style.display = 'inline-block';
        this.exportBtn.disabled = true;

        const startTime = performance.now();
        let lastFrame = -1;

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const currentFrame = Math.floor(elapsed / msPerFrame);

            if (currentFrame !== lastFrame && currentFrame < timeline.length) {
                this.displayViseme(timeline[currentFrame]);
                lastFrame = currentFrame;
            }

            if (elapsed < this.audioDuration * 1000) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.stopAnimation();
            }
        };

        this.animationId = requestAnimationFrame(animate);
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }

        this.displayViseme('MBP');
        this.previewBtn.style.display = 'inline-block';
        this.stopBtn.style.display = 'none';
        this.exportBtn.disabled = false;
        this.updateUI();
    }

    async exportVideo() {
        const text = this.textInput.value.trim();
        if (!text || !this.audioFile) return;

        // Disable controls
        this.previewBtn.disabled = true;
        this.exportBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.exportProgress.style.display = 'block';

        // Convert text to IPA on-demand
        const ipaPhonetics = await this.convertTextToIPA(text);
        if (!ipaPhonetics) {
            this.updateUI();
            return;
        }

        const fps = parseInt(this.framerateSelect.value);
        const segments = this.parsePhonetics(ipaPhonetics);
        const { timeline, msPerFrame } = this.generateTimeline(segments, this.audioDuration, fps);

        // Setup MediaRecorder
        const stream = this.canvas.captureStream(fps);
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9,opus',
            videoBitsPerSecond: 8000000
        });

        const chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lipsync_${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);

            // Re-enable controls
            this.exportProgress.style.display = 'none';
            this.updateUI();
        };

        // Start recording
        mediaRecorder.start();

        // Render frames
        for (let frame = 0; frame < timeline.length; frame++) {
            this.displayViseme(timeline[frame]);
            this.exportStatus.textContent = `${frame + 1} / ${timeline.length}`;

            // Wait for next frame
            await new Promise(resolve => setTimeout(resolve, msPerFrame));
        }

        // Stop recording
        mediaRecorder.stop();
    }

}

// Initialize app
new LipSyncApp();
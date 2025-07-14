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

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

class LipSyncApp {
    constructor() {
        this.audioFile = null;
        this.audioDuration = 0;
        this.animationId = null;
        this.audioElement = null;
        this.imageCache = new Map();
        this.ipaPhonetics = '';
        this.charactersConfig = null;
        this.selectedCharacter = '';
        this.selectedAngle = '';
        this.canvas = null;
        this.ctx = null;
        this.timeline = [];
        this.msPerFrame = 0;

        this.bindElements();
        this.bindEvents();
        this.initCanvas();
        this.loadCharactersConfig();
    }

    bindElements() {
        const ids = ['audio-file', 'text-input', 'api-key', 'transcribe-btn', 'ipa-output',
            'transcribe-status', 'transcribe-error', 'api-error', 'preview-btn',
            'stop-btn', 'duration-info', 'duration-display', 'render-canvas',
            'audio-error', 'framerate-select', 'character-select', 'angle-select',
            'export-btn', 'export-progress', 'export-status'];

        ids.forEach(id => {
            this[id.replace(/-/g, '_')] = document.getElementById(id);
        });
    }

    bindEvents() {
        this.audio_file.onchange = e => this.handleAudioFile(e);
        this.text_input.oninput = () => this.updateUI();
        this.api_key.oninput = () => this.updateUI();
        this.transcribe_btn.onclick = () => this.transcribeText();
        this.preview_btn.onclick = () => this.startAnimation();
        this.stop_btn.onclick = () => this.stopAnimation();
        this.export_btn.onclick = () => this.exportVideo();
        this.character_select.onchange = () => this.handleCharacterChange();
        this.angle_select.onchange = () => this.handleAngleChange();
    }

    initCanvas() {
        this.canvas = this.render_canvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillRect(0, 0, 1080, 1080);
    }

    async loadCharactersConfig() {
        try {
            const response = await fetch('characters.json');
            if (response.ok) {
                this.charactersConfig = await response.json();
                this.populateCharacterDropdown();
            } else {
                this.charactersConfig = { characters: [] };
                this.populateCharacterDropdown();
            }
        } catch (error) {
            console.error('Error loading characters config:', error);
            this.charactersConfig = { characters: [] };
            this.populateCharacterDropdown();
        }
    }

    populateCharacterDropdown() {
        this.character_select.innerHTML = '<option value="">Select character...</option>';

        this.charactersConfig.characters.forEach(character => {
            const option = document.createElement('option');
            option.value = character.id;
            option.textContent = character.name;
            this.character_select.appendChild(option);
        });
    }

    handleCharacterChange() {
        const selectedCharacterId = this.character_select.value;
        this.selectedCharacter = selectedCharacterId;

        this.angle_select.innerHTML = '<option value="">Select angle...</option>';
        this.selectedAngle = '';

        if (selectedCharacterId) {
            const character = this.charactersConfig.characters.find(c => c.id === selectedCharacterId);
            if (character) {
                character.angles.forEach(angle => {
                    const option = document.createElement('option');
                    option.value = angle;
                    option.textContent = `${angle}°`;
                    this.angle_select.appendChild(option);
                });
            }
        }

        this.imageCache.clear();
        this.updateUI();
    }

    handleAngleChange() {
        this.selectedAngle = this.angle_select.value;

        this.imageCache.clear();
        if (this.selectedCharacter && this.selectedAngle) {
            this.preloadImages();
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
            console.error('Error preloading images:', error);
        }
    }

    handleAudioFile(e) {
        this.clearError('audio');
        const file = e.target.files[0];

        if (!file) {
            this.resetAudio();
            return;
        }

        this.audioFile = file;
        const audio = new Audio(URL.createObjectURL(file));

        audio.onloadedmetadata = () => {
            this.audioDuration = audio.duration;
            this.duration_display.textContent = audio.duration.toFixed(2);
            this.duration_info.style.display = 'block';
            this.updateUI();
        };

        audio.onerror = () => {
            this.showError('audio', 'Error loading audio file');
            this.resetAudio();
        };
    }

    resetAudio() {
        this.audioFile = null;
        this.audioDuration = 0;
        this.duration_info.style.display = 'none';
        this.updateUI();
    }

    updateUI() {
        const hasApiKey = this.api_key.value.trim();
        const hasText = this.text_input.value.trim();
        const hasAudio = this.audioFile;
        const hasIPA = this.ipaPhonetics;
        const hasCharacter = this.selectedCharacter;
        const hasAngle = this.selectedAngle;

        this.transcribe_btn.disabled = !hasApiKey || !hasText;
        this.preview_btn.disabled = !hasAudio || !hasIPA || !hasCharacter || !hasAngle;
        this.export_btn.disabled = !hasAudio || !hasIPA || !hasCharacter || !hasAngle;

        if (!this.preview_btn.disabled && !this.animationId) {
            this.displayViseme('MBP');
        }
    }

    showError(type, message) {
        this[`${type}_error`].textContent = message;
    }

    clearError(type) {
        this[`${type}_error`].textContent = '';
    }

    async transcribeText() {
        const apiKey = this.api_key.value.trim();
        const text = this.text_input.value.trim();

        this.clearError('transcribe');
        this.clearError('api');
        this.transcribe_status.style.display = 'block';
        this.transcribe_btn.disabled = true;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Convert this text to IPA (International Phonetic Alphabet) notation. When there are two or more sentences, use dots (.) to seperate them. Do not place a dot at the end. Return only the IPA transcription, nothing else: "${text}"`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.candidates?.[0]?.content) {
                this.ipaPhonetics = data.candidates[0].content.parts[0].text.trim();
                this.ipa_output.textContent = this.ipaPhonetics;
                this.updateUI();
            } else {
                throw new Error('Invalid response format from Gemini API');
            }

        } catch (error) {
            console.error('Transcription error:', error);
            const errorType = error.message.includes('API_KEY_INVALID') || error.message.includes('403') ? 'api' : 'transcribe';
            const message = errorType === 'api' ? 'Invalid API key. Please check your Gemini API key.' : `Error: ${error.message}`;
            this.showError(errorType, message);
        } finally {
            this.transcribe_status.style.display = 'none';
            this.transcribe_btn.disabled = false;
            this.updateUI();
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
        this.ctx.fillRect(0, 0, 1080, 1080);

        if (!this.selectedCharacter || !this.selectedAngle) {
            this.ctx.fillStyle = '#ff7139';
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
            this.ctx.fillStyle = '#ff7139';
            this.ctx.font = '72px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(viseme, 540, 540);
        }
    }

    startAnimation() {
        this.stopAnimation();

        if (!this.ipaPhonetics) return;

        const fps = parseInt(this.framerate_select.value);

        const segments = this.parsePhonetics(this.ipaPhonetics);
        const { timeline, msPerFrame } = this.generateTimeline(segments, this.audioDuration, fps);

        this.timeline = timeline;
        this.msPerFrame = msPerFrame;

        this.audioElement = new Audio(URL.createObjectURL(this.audioFile));
        this.audioElement.play();

        this.preview_btn.style.display = 'none';
        this.stop_btn.style.display = 'inline-block';
        this.export_btn.disabled = true;

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
        this.preview_btn.style.display = 'inline-block';
        this.stop_btn.style.display = 'none';
        this.export_btn.disabled = false;
        this.updateUI();
    }

    async exportVideo() {
        if (!this.ipaPhonetics || !this.audioFile) return;

        // Disable controls
        this.preview_btn.disabled = true;
        this.export_btn.disabled = true;
        this.stop_btn.disabled = true;
        this.export_progress.style.display = 'block';

        const fps = parseInt(this.framerate_select.value);
        const segments = this.parsePhonetics(this.ipaPhonetics);
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
            this.export_progress.style.display = 'none';
            this.updateUI();
        };

        // Start recording
        mediaRecorder.start();

        // Render frames
        for (let frame = 0; frame < timeline.length; frame++) {
            this.displayViseme(timeline[frame]);
            this.export_status.textContent = `${frame + 1} / ${timeline.length}`;

            // Wait for next frame
            await new Promise(resolve => setTimeout(resolve, msPerFrame));
        }

        // Stop recording
        mediaRecorder.stop();
    }
}

// Initialize app
new LipSyncApp();
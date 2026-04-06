/**
 * Utility for handling PCM audio recording and playback for Gemini Live.
 */

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private playbackQueue: Int16Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;

  constructor(private inputSampleRate = 16000, private outputSampleRate = 24000) {}

  async startRecording(onAudioData: (base64Data: string) => void) {
    this.audioContext = new AudioContext({ sampleRate: this.inputSampleRate });
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    // Using ScriptProcessorNode for simplicity in this environment
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.float32ToInt16(inputData);
      const base64Data = this.arrayBufferToBase64(pcmData.buffer);
      onAudioData(base64Data);
    };
  }

  stopRecording() {
    this.source?.disconnect();
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.audioContext = null;
  }

  addPlaybackData(base64Data: string) {
    const buffer = this.base64ToArrayBuffer(base64Data);
    const pcmData = new Int16Array(buffer);
    this.playbackQueue.push(pcmData);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.playbackQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const pcmData = this.playbackQueue.shift()!;
    
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.outputSampleRate });
      this.nextStartTime = this.audioContext.currentTime;
    }

    const float32Data = this.int16ToFloat32(pcmData);
    const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.outputSampleRate);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    source.onended = () => {
      this.playNext();
    };
  }

  stopPlayback() {
    this.playbackQueue = [];
    this.isPlaying = false;
    // To fully stop, we'd need to track all active sources, but clearing the queue stops new ones.
  }

  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  private int16ToFloat32(int16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

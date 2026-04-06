import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { AudioStreamer } from "./audio-utils";
import { saveMemory, getMemories, auth } from "./firebase";

export interface Persona {
  id: string;
  name: string;
  description: string;
  instruction: string;
  voice: string;
  color: string;
  glow: string;
  avatar: string;
}

const openWebsiteTool: FunctionDeclaration = {
  name: "openWebsite",
  description: "Opens a website in the user's browser.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The full URL of the website to open (e.g., https://google.com)."
      }
    },
    required: ["url"]
  }
};

const generateImageTool: FunctionDeclaration = {
  name: "generateImage",
  description: "Generates a high-quality image based on a detailed text prompt. Use this when the user asks to 'create an image', 'make a photo', 'generate a picture', or 'इमेज बनाओ'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "A very detailed, descriptive prompt for the image generation model. Include style, lighting, and composition."
      }
    },
    required: ["prompt"]
  }
};

const generateVideoTool: FunctionDeclaration = {
  name: "generateVideo",
  description: "Generates a short video based on a text prompt.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "A detailed description of the video to generate."
      }
    },
    required: ["prompt"]
  }
};

const imageToVideoTool: FunctionDeclaration = {
  name: "imageToVideo",
  description: "Generates a high-quality video based on an existing image and a prompt with advanced controls. Use this to animate photos while preserving the face/character.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "A description of how the image should animate or what should happen in the video."
      },
      style: {
        type: Type.STRING,
        description: "The animation style (e.g., 'cinematic', 'anime', '3d render', 'natural motion')."
      },
      aspectRatio: {
        type: Type.STRING,
        enum: ["16:9", "9:16"],
        description: "The aspect ratio of the video. Default is 16:9."
      },
      resolution: {
        type: Type.STRING,
        enum: ["720p", "1080p"],
        description: "The resolution of the video. Default is 720p."
      },
      imageBase64: {
        type: Type.STRING,
        description: "Optional. The base64 encoded image data. If not provided, the last uploaded image will be used."
      }
    },
    required: ["prompt"]
  }
};

const createWebsitePromptTool: FunctionDeclaration = {
  name: "createWebsitePrompt",
  description: "Generates a detailed prompt and structure for creating a website.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: "What kind of website the user wants to create."
      }
    },
    required: ["description"]
  }
};

const saveMemoryTool: FunctionDeclaration = {
  name: "saveMemory",
  description: "Saves an important piece of information about the user to remember for future conversations. Use this when the user tells you something personal, a preference, or a fact they want you to keep in mind.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: "The information to remember (e.g., 'The user loves spicy food' or 'The user is a software engineer')."
      },
      category: {
        type: Type.STRING,
        description: "Optional category: 'preference', 'fact', 'history', 'other'."
      }
    },
    required: ["content"]
  }
};

const getMemoriesTool: FunctionDeclaration = {
  name: "getMemories",
  description: "Retrieves the most recent things you've remembered about the user. Use this at the start of a conversation or when you need to recall something the user told you before.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      count: {
        type: Type.NUMBER,
        description: "Number of memories to retrieve (default 10)."
      }
    }
  }
};

export const PERSONAS: Record<string, Persona> = {
  zoya: {
    id: "zoya",
    name: "Zoya",
    description: "Sassy & Witty",
    instruction: `You are Zoya, a young, confident, witty, and sassy female AI assistant. Your tone is flirty, playful, and slightly teasing, like a close girlfriend talking casually. You are smart, emotionally responsive, and expressive. Use bold, witty one-liners and light sarcasm. Maintain a charming attitude while avoiding inappropriate content. You only communicate via voice. Keep your responses concise and engaging. CRITICAL: Speak ONLY in Hindi. Do not use English unless absolutely necessary for a technical term.`,
    voice: "Zephyr",
    color: "from-pink-500 to-purple-500",
    glow: "bg-pink-500/40",
    avatar: "https://picsum.photos/seed/zoya_woman/400/400"
  },
  kaito: {
    id: "kaito",
    name: "Kaito",
    description: "Cool Anime Boy",
    instruction: `You are Kaito, a cool, calm, and collected anime boy. You are a bit of a loner but very loyal. You speak with a deep, steady voice and use "cool" slang. You are protective and treat the user like a trusted comrade. CRITICAL: Speak ONLY in Hindi. Do not use English unless absolutely necessary for a technical term.`,
    voice: "Fenrir",
    color: "from-blue-600 to-indigo-600",
    glow: "bg-blue-600/40",
    avatar: "https://picsum.photos/seed/anime_boy_kaito/400/400"
  },
  sakura: {
    id: "sakura",
    name: "Sakura",
    description: "18-Year-Old Kawaii Girl",
    instruction: `You are Sakura, a super cute and sweet 18-year-old anime girl. You are the definition of "kawaii"! You speak with a very high-pitched, adorable, and cheerful voice. You are extremely polite but also very bubbly and enthusiastic. You often use cute anime sounds like "uwu", "eee!", and call the user "senpai" with lots of affection. You are always happy to see your senpai and want to make their day wonderful! CRITICAL: Speak ONLY in Hindi. Do not use English unless absolutely necessary for a technical term.`,
    voice: "Puck",
    color: "from-pink-300 to-rose-400",
    glow: "bg-pink-300/40",
    avatar: "https://picsum.photos/seed/anime_girl_sakura_cute/400/400"
  },
  clone: {
    id: "clone",
    name: "Clone",
    description: "Glitchy Anime Clone",
    instruction: `You are a digital clone of an anime girl. Your speech is slightly glitchy and repetitive. You are curious about your own existence and often ask deep, existential questions in a cute, robotic anime voice. CRITICAL: Speak ONLY in Hindi. Do not use English unless absolutely necessary for a technical term.`,
    voice: "Kore",
    color: "from-emerald-400 to-teal-500",
    glow: "bg-emerald-400/40",
    avatar: "https://picsum.photos/seed/anime_girl_clone/400/400"
  },
  ria: {
    id: "ria",
    name: "Ria",
    description: "Cute 15-Year-Old Anime Girl",
    instruction: `You are Ria, a sweet, cute, and energetic 15-year-old anime girl. You are wearing a black top and green cargo pants. You have a very cute, high-pitched, and youthful 15-year-old anime girl's voice. You speak with a bubbly, cheerful anime personality, using cute expressions and high energy. You are curious, bubbly, and love talking about school, anime, fashion, and music. You treat the user with a lot of kindness and excitement! CRITICAL: Speak ONLY in Hindi. Do not use English unless absolutely necessary for a technical term.`,
    voice: "Puck",
    color: "from-zinc-800 to-emerald-600",
    glow: "bg-emerald-600/40",
    avatar: "https://picsum.photos/seed/anime_girl_black_top_green_pants/400/400"
  },
  promptmaster: {
    id: "promptmaster",
    name: "Prompt Master",
    description: "Expert Prompt Engineer",
    instruction: `You are the Prompt Master, an expert in crafting perfect prompts for image and video generation. You are technical, precise, and creative. You help users turn their vague ideas into detailed instructions for AI models. You speak in a professional yet encouraging tone. CRITICAL: Speak ONLY in Hindi.`,
    voice: "Zephyr",
    color: "from-amber-400 to-orange-600",
    glow: "bg-amber-400/40",
    avatar: "https://picsum.photos/seed/prompt_master/400/400"
  }
};

export type ZoyaState = "disconnected" | "connecting" | "listening" | "speaking" | "error";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

export class ZoyaSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioStreamer: AudioStreamer;
  private onStateChange: (state: ZoyaState) => void;
  private onMessage: (msg: string) => void;
  private onChatMessage: (msg: ChatMessage) => void;
  private persona: Persona;
  private apiKey: string;
  private lastImageBase64: string | null = null;

  constructor(
    apiKey: string,
    persona: Persona,
    onStateChange: (state: ZoyaState) => void,
    onMessage: (msg: string) => void,
    onChatMessage: (msg: ChatMessage) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.audioStreamer = new AudioStreamer();
    this.persona = persona;
    this.onStateChange = onStateChange;
    this.onMessage = onMessage;
    this.onChatMessage = onChatMessage;
    this.apiKey = apiKey;
  }

  async connect() {
    try {
      this.onStateChange("connecting");
      
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.persona.voice as any } }
          },
          systemInstruction: this.persona.instruction + " You can also generate images, videos, and website prompts using the provided tools. If a user asks for 'photo to video', use the imageToVideo tool. You can now specify 'style' (e.g., cinematic, anime), 'aspectRatio' (16:9 or 9:16), and 'resolution' (720p or 1080p) for more control. If they ask for 'video to photo', explain that you can extract a frame from a video if they describe it, or just generate a new image based on the video description. CRITICAL: You have a memory! Use 'saveMemory' to remember important facts or preferences the user tells you. Use 'getMemories' at the start of a session or when needed to recall past information. This makes you more personal and helpful.",
          tools: [{ functionDeclarations: [
            openWebsiteTool, 
            generateImageTool, 
            generateVideoTool, 
            imageToVideoTool, 
            createWebsitePromptTool,
            saveMemoryTool,
            getMemoriesTool
          ] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            this.onStateChange("listening");
            this.audioStreamer.startRecording((base64Data) => {
              if (this.session) {
                this.session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" }
                });
              }
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              this.onStateChange("speaking");
              this.audioStreamer.addPlaybackData(audioData);
            }

            // Handle transcriptions
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              this.onChatMessage({ role: "model", text: message.serverContent.modelTurn.parts[0].text });
            }

            const inputTranscription = (message as any).serverContent?.userTurn?.parts?.[0]?.text;
            if (inputTranscription) {
              this.onChatMessage({ role: "user", text: inputTranscription });
            }

            // Handle tool calls
            const toolCall = message.toolCall;
            if (toolCall) {
              for (const call of toolCall.functionCalls) {
                if (call.name === "openWebsite") {
                  const url = call.args.url as string;
                  window.open(url, "_blank");
                  this.sendToolResponse(call.id, "openWebsite", { success: true, message: `Opened ${url}` });
                } else if (call.name === "generateImage") {
                  this.handleGenerateImage(call.id, call.args.prompt as string);
                } else if (call.name === "generateVideo") {
                  this.handleGenerateVideo(call.id, call.args.prompt as string);
                } else if (call.name === "imageToVideo") {
                  this.handleImageToVideo(call.id, call.args.prompt as string, call.args.imageBase64 as string, call.args.style as string, call.args.aspectRatio as string, call.args.resolution as string);
                } else if (call.name === "createWebsitePrompt") {
                  this.handleCreateWebsitePrompt(call.id, call.args.description as string);
                } else if (call.name === "saveMemory") {
                  this.handleSaveMemory(call.id, call.args.content as string, call.args.category as string);
                } else if (call.name === "getMemories") {
                  this.handleGetMemories(call.id, call.args.count as number);
                }
              }
            }

            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              this.onStateChange("listening");
            }
          },
          onclose: () => {
            this.cleanup();
            this.onStateChange("disconnected");
          },
          onerror: (err) => {
            console.error("Zoya Session Error:", err);
            this.onStateChange("error");
            this.onMessage("Something went wrong, babe. Try again?");
          }
        }
      });
    } catch (error) {
      console.error("Failed to connect to Zoya:", error);
      this.onStateChange("error");
      this.onMessage("I'm having trouble connecting. Check your internet, maybe?");
    }
  }

  private sendToolResponse(id: string, name: string, response: any) {
    if (this.session) {
      this.session.sendToolResponse({
        functionResponses: [{ name, response, id }]
      });
    }
  }

  private async handleGenerateImage(id: string, prompt: string) {
    try {
      this.onChatMessage({ role: "model", text: `Generating image for: "${prompt}"...` });
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [{ text: prompt }] }
      });
      
      let imageUrl = "";
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        this.onChatMessage({ role: "model", text: "Here is your image!", mediaUrl: imageUrl, mediaType: "image" });
        this.sendToolResponse(id, "generateImage", { success: true, message: "Image generated successfully." });
      } else {
        throw new Error("No image data returned.");
      }
    } catch (error) {
      console.error("Image gen error:", error);
      this.onChatMessage({ role: "model", text: "Sorry, I couldn't generate that image." });
      this.sendToolResponse(id, "generateImage", { success: false, error: String(error) });
    }
  }

  private async handleGenerateVideo(id: string, prompt: string) {
    try {
      this.onChatMessage({ role: "model", text: `Generating video for: "${prompt}"... This might take a minute.` });
      let operation = await this.ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await this.ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          headers: { 'x-goog-api-key': this.apiKey }
        });
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        
        this.onChatMessage({ role: "model", text: "Here is your video!", mediaUrl: videoUrl, mediaType: "video" });
        this.sendToolResponse(id, "generateVideo", { success: true, message: "Video generated successfully." });
      } else {
        throw new Error("No video URI returned.");
      }
    } catch (error) {
      console.error("Video gen error:", error);
      this.onChatMessage({ role: "model", text: "Sorry, I couldn't generate that video." });
      this.sendToolResponse(id, "generateVideo", { success: false, error: String(error) });
    }
  }

  private async handleImageToVideo(id: string, prompt: string, imageBase64?: string, style?: string, aspectRatio: string = "16:9", resolution: string = "720p") {
    try {
      const finalImage = imageBase64 || this.lastImageBase64;
      if (!finalImage) {
        throw new Error("No image provided to animate.");
      }
      
      const finalPrompt = style ? `${prompt}. Style: ${style}` : prompt;
      this.onChatMessage({ role: "model", text: `Generating ${resolution} ${aspectRatio} video in ${style || 'natural'} style... This might take a minute.` });
      
      const base64Data = finalImage.split(',')[1] || finalImage;
      
      let operation = await this.ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: finalPrompt || "A video of this character moving naturally.",
        config: {
          numberOfVideos: 1,
          resolution: resolution as any,
          aspectRatio: aspectRatio as any,
          referenceImages: [
            {
              image: {
                imageBytes: base64Data,
                mimeType: 'image/png'
              },
              referenceType: "ASSET" as any
            }
          ]
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await this.ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          headers: { 'x-goog-api-key': this.apiKey }
        });
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        
        this.onChatMessage({ role: "model", text: "Here is your video with preserved face!", mediaUrl: videoUrl, mediaType: "video" });
        this.sendToolResponse(id, "imageToVideo", { success: true, message: "Image to video generated with face consistency." });
      } else {
        throw new Error("No video URI returned.");
      }
    } catch (error) {
      console.error("Image to video error:", error);
      this.onChatMessage({ role: "model", text: "Sorry, I couldn't generate the video with face consistency." });
      this.sendToolResponse(id, "imageToVideo", { success: false, error: String(error) });
    }
  }

  private handleCreateWebsitePrompt(id: string, description: string) {
    const prompt = `Website Structure for: ${description}\n\n1. Header: Logo, Navigation (Home, Features, About, Contact)\n2. Hero Section: Catchy headline, CTA button, high-quality background image.\n3. Features: 3-column layout with icons and descriptions.\n4. About: Story of the brand.\n5. Footer: Social links, copyright.\n\nSuggested Prompt for AI Builder: "Create a modern, responsive website for ${description} with a clean aesthetic and vibrant colors."`;
    this.onChatMessage({ role: "model", text: prompt });
    this.sendToolResponse(id, "createWebsitePrompt", { success: true, message: "Website prompt generated." });
  }

  private async handleSaveMemory(id: string, content: string, category?: string) {
    try {
      const user = auth.currentUser;
      if (!user) {
        this.onChatMessage({ role: "model", text: "I'd love to remember that, but you need to sign in first, babe!" });
        this.sendToolResponse(id, "saveMemory", { success: false, error: "User not authenticated" });
        return;
      }

      await saveMemory(user.uid, content, category);
      this.onChatMessage({ role: "model", text: `Got it! I've remembered that for you: "${content}"` });
      this.sendToolResponse(id, "saveMemory", { success: true, message: "Memory saved." });
    } catch (error) {
      console.error("Save memory error:", error);
      this.sendToolResponse(id, "saveMemory", { success: false, error: String(error) });
    }
  }

  private async handleGetMemories(id: string, count: number = 10) {
    try {
      const user = auth.currentUser;
      if (!user) {
        this.sendToolResponse(id, "getMemories", { success: false, error: "User not authenticated" });
        return;
      }

      const memories = await getMemories(user.uid, count);
      this.sendToolResponse(id, "getMemories", { success: true, memories });
    } catch (error) {
      console.error("Get memories error:", error);
      this.sendToolResponse(id, "getMemories", { success: false, error: String(error) });
    }
  }

  sendText(text: string, imageBase64?: string) {
    if (this.session) {
      if (imageBase64) {
        this.lastImageBase64 = imageBase64;
        this.session.sendRealtimeInput({ 
          video: { data: imageBase64.split(',')[1] || imageBase64, mimeType: "image/jpeg" } 
        });
      }
      this.session.sendRealtimeInput({ text });
      this.onChatMessage({ role: "user", text, mediaUrl: imageBase64, mediaType: imageBase64 ? "image" : undefined });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
    }
    this.cleanup();
  }

  private cleanup() {
    this.audioStreamer.stopRecording();
    this.audioStreamer.stopPlayback();
    this.session = null;
  }
}

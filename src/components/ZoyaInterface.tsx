import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { Mic, Power, Loader2, AlertCircle, ChevronLeft, ChevronRight, MessageSquare, Send, X, Image as ImageIcon, Paperclip, User as UserIcon, LogOut, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ZoyaSession, ZoyaState, PERSONAS, Persona, ChatMessage } from "../lib/zoya-session";
import { Waveform } from "./Waveform";
import { auth, signInWithGoogle, signOut, onAuthStateChanged, User, getUserProfile, saveUserProfile } from "../lib/firebase";

export const ZoyaInterface = () => {
  const [state, setState] = useState<ZoyaState>("disconnected");
  const [message, setMessage] = useState<string>("");
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS.zoya);
  const [vibeMode, setVibeMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<ZoyaSession | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const personaIds = Object.keys(PERSONAS);
  const currentIndex = personaIds.indexOf(activePersona.id);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          if (profile.preferredPersonaId && PERSONAS[profile.preferredPersonaId]) {
            setActivePersona(PERSONAS[profile.preferredPersonaId]);
          }
          if (typeof profile.vibeMode === 'boolean') {
            setVibeMode(profile.vibeMode);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const saveSettings = async (personaId: string, vibe: boolean) => {
    if (user) {
      await saveUserProfile(user.uid, {
        preferredPersonaId: personaId,
        vibeMode: vibe
      });
    }
  };

  const nextPersona = () => {
    if (state !== "disconnected") return;
    const nextIndex = (currentIndex + 1) % personaIds.length;
    const next = PERSONAS[personaIds[nextIndex]];
    setActivePersona(next);
    saveSettings(next.id, vibeMode);
  };

  const prevPersona = () => {
    if (state !== "disconnected") return;
    const prevIndex = (currentIndex - 1 + personaIds.length) % personaIds.length;
    const prev = PERSONAS[personaIds[prevIndex]];
    setActivePersona(prev);
    saveSettings(prev.id, vibeMode);
  };

  const toggleSession = async () => {
    if (state === "disconnected" || state === "error") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        setMessage("I need an API key to talk, babe. Check your settings.");
        setState("error");
        return;
      }

      const session = new ZoyaSession(
        apiKey,
        activePersona,
        (newState) => setState(newState),
        (msg) => setMessage(msg),
        (chatMsg) => setChatMessages(prev => [...prev, chatMsg])
      );
      sessionRef.current = session;
      await session.connect();
    } else {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      setState("disconnected");
    }
  };

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
    };
  }, []);

  const getStatusText = () => {
    switch (state) {
      case "connecting": return "Connecting...";
      case "listening": return "Listening...";
      case "speaking": return `${activePersona.name} is talking...`;
      case "error": return "Error occurred...";
      default: return `Talk to ${activePersona.name}?`;
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case "connecting": return "text-blue-400";
      case "listening": return "text-green-400";
      case "speaking": 
        if (activePersona.id === 'zoya') return 'text-pink-400';
        if (activePersona.id === 'kaito') return 'text-blue-400';
        if (activePersona.id === 'sakura') return 'text-rose-300';
        if (activePersona.id === 'clone') return 'text-emerald-400';
        if (activePersona.id === 'ria') return 'text-emerald-400';
        return 'text-pink-400';
      case "error": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const handleSendText = (e?: FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !sessionRef.current) return;
    
    sessionRef.current.sendText(inputText || "Here is an image for you.", selectedImage || undefined);
    setSelectedImage(null);
    setInputText("");
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans overflow-hidden relative">
      {/* Chat Toggle Button */}
      <div className="absolute top-8 left-8 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsChatOpen(true)}
          className="p-3 rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:text-white transition-colors relative"
        >
          <MessageSquare className="w-5 h-5" />
          {chatMessages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
              {chatMessages.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* Chat Sidebar/Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute left-0 top-0 bottom-0 w-full sm:w-80 bg-zinc-950 border-r border-zinc-800 z-50 flex flex-col shadow-2xl"
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')}`} />
                <h2 className="font-bold uppercase tracking-widest text-xs">{activePersona.name} Chat</h2>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-2">
                  <MessageSquare className="w-12 h-12" />
                  <p className="text-xs uppercase tracking-widest">No messages yet</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === "user" 
                      ? "bg-zinc-800 text-white rounded-tr-none" 
                      : `bg-gradient-to-br ${activePersona.color} text-white rounded-tl-none`
                  }`}>
                    {msg.text}
                    {msg.mediaUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                        {msg.mediaType === "image" ? (
                          <img src={msg.mediaUrl} alt="Generated" className="w-full h-auto" referrerPolicy="no-referrer" />
                        ) : (
                          <video src={msg.mediaUrl} controls className="w-full h-auto" />
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendText} className="p-4 border-t border-zinc-800 space-y-2">
              {selectedImage && (
                <div className="relative inline-block">
                  <img src={selectedImage} alt="Selected" className="w-16 h-16 rounded-lg object-cover border border-zinc-700" />
                  <button 
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => setInputText("एक सुंदर इमेज बनाओ: ")}
                  className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
                  title="Generate Image"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
                  title="Upload Image"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  disabled={state === "disconnected"}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-pink-500/50 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={state === "disconnected" || (!inputText.trim() && !selectedImage)}
                  className={`p-2 rounded-full transition-all ${
                    (!inputText.trim() && !selectedImage) || state === "disconnected"
                      ? "bg-zinc-900 text-zinc-700"
                      : `bg-gradient-to-r ${activePersona.color} text-white shadow-lg shadow-pink-500/20`
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: vibeMode ? [1, 1.3, 1] : state === "speaking" ? [1, 1.2, 1] : 1,
            opacity: state === "disconnected" ? 0.1 : vibeMode ? 0.6 : 0.3,
            rotate: vibeMode ? [0, 90, 180, 270, 360] : 0,
          }}
          transition={{
            duration: vibeMode ? 2 : 1,
            repeat: Infinity,
            ease: "linear",
          }}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-1000 ${
            vibeMode ? "bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500" :
            state === "speaking" ? activePersona.glow : 
            state === "listening" ? "bg-green-500/20" : 
            state === "connecting" ? "bg-blue-500/20" : 
            "bg-purple-500/10"
          }`}
        />
      </div>

      {/* Header / Persona Selector */}
      <div className="z-10 flex items-center gap-8 mb-8">
        <button 
          onClick={prevPersona} 
          disabled={state !== "disconnected"}
          className={`p-2 rounded-full transition-colors ${state !== "disconnected" ? "opacity-20" : "hover:bg-white/10"}`}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <motion.div 
          key={activePersona.id}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <h1 className={`text-5xl font-bold tracking-tighter bg-gradient-to-r ${activePersona.color} bg-clip-text text-transparent mb-1`}>
            {activePersona.name.toUpperCase()}
          </h1>
          <p className="text-gray-500 font-medium tracking-widest uppercase text-[10px]">
            {activePersona.description}
          </p>
        </motion.div>

        <button 
          onClick={nextPersona} 
          disabled={state !== "disconnected"}
          className={`p-2 rounded-full transition-colors ${state !== "disconnected" ? "opacity-20" : "hover:bg-white/10"}`}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Main Interaction Area */}
      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-md">
        <div className="relative h-64 flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            {state === "disconnected" || state === "error" ? (
              <motion.div
                key="avatar"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative group"
              >
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${activePersona.color} blur-xl opacity-20 group-hover:opacity-40 transition-opacity`} />
                <img 
                  src={activePersona.avatar} 
                  alt={activePersona.name}
                  referrerPolicy="no-referrer"
                  className="w-48 h-48 rounded-full object-cover border-2 border-white/10 grayscale hover:grayscale-0 transition-all duration-500"
                />
                {state === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex flex-col items-center gap-4"
              >
                <img 
                  src={activePersona.avatar} 
                  alt={activePersona.name}
                  referrerPolicy="no-referrer"
                  className={`w-32 h-32 rounded-full object-cover border-2 transition-all duration-500 ${state === "speaking" ? "border-pink-500 scale-110 shadow-[0_0_30px_rgba(236,72,153,0.3)]" : "border-green-500"}`}
                />
                <Waveform 
                  isSpeaking={state === "speaking"} 
                  isListening={state === "listening"} 
                  isVibeMode={vibeMode}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status Text */}
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`text-lg font-medium ${getStatusColor()}`}
        >
          {getStatusText()}
        </motion.div>

        {/* Error Message */}
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-center text-red-400/80 max-w-xs"
          >
            {message}
          </motion.p>
        )}

        {/* Power Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleSession}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${
            state === "disconnected" || state === "error"
              ? "bg-zinc-900 border-2 border-zinc-800 hover:border-white/20"
              : `bg-gradient-to-r ${activePersona.color} border-2 border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)]`
          }`}
        >
          {state === "connecting" ? (
            <Loader2 className="w-10 h-10 animate-spin text-white" />
          ) : (
            <Power className={`w-10 h-10 text-white ${state !== "disconnected" ? "animate-pulse" : ""}`} />
          )}
          
          {/* Pulse Ring */}
          {(state === "listening" || state === "speaking") && (
            <motion.div
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`absolute inset-0 rounded-full border-2 ${
                activePersona.id === 'zoya' ? 'border-pink-500' : 
                activePersona.id === 'kaito' ? 'border-blue-500' : 
                activePersona.id === 'sakura' ? 'border-rose-300' : 
                activePersona.id === 'clone' ? 'border-emerald-400' : 
                activePersona.id === 'ria' ? 'border-emerald-500' : 
                'border-pink-500'
              }`}
            />
          )}
        </motion.button>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-8 text-center z-10">
        <p className="text-zinc-700 text-[10px] uppercase tracking-[0.2em]">
          Gemini 3.1 Flash Live • {activePersona.name} Edition
        </p>
      </div>

      {/* Vibe Mode Toggle & Profile */}
      <div className="absolute top-8 right-8 z-20 flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            const newVibe = !vibeMode;
            setVibeMode(newVibe);
            saveSettings(activePersona.id, newVibe);
          }}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 border ${
            vibeMode 
              ? "bg-gradient-to-r from-pink-500 to-cyan-500 border-white/50 shadow-[0_0_20px_rgba(236,72,153,0.5)]" 
              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white"
          }`}
        >
          {vibeMode ? "Vibe: ON" : "Vibe: OFF"}
        </motion.button>

        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="p-3 rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-full" />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </motion.button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50"
              >
                {user ? (
                  <>
                    <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                      <p className="text-xs font-bold text-white truncate">{user.displayName || "User"}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        signOut();
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      signInWithGoogle();
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In with Google
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

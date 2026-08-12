import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  MessageSquareCode, 
  ArrowUp, 
  Mic, 
  Plus, 
  X, 
  Box,
  Loader2,
  Wand2
} from 'lucide-react';
import { editorStore } from '../../store/EditorStore';

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; actionApplied?: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'model';
    parts: Array<
      | { text: string }
      | { functionCalls: Array<{ name: string; args: any; id?: string }> }
      | { functionResponses: Array<{ name: string; response: any; id?: string }> }
    >;
  }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selObj = editorStore.getSelectedObject();

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Automatically close chat if selection is cleared
  useEffect(() => {
    if (!selObj) {
      setIsOpen(false);
    }
  }, [selObj]);

  if (!selObj) return null;

  const handleSend = async () => {
    if (!prompt.trim() || isSending) return;

    const userPrompt = prompt.trim();
    setPrompt('');
    setMessages(prev => [...prev, { sender: 'user', text: userPrompt }]);
    setIsSending(true);

    try {
      let currentHistory = [...chatHistory];
      const isMcp = editorStore.mcpAgentModeEnabled;

      if (!isMcp) {
        // Standard single-step AI action flow
        const response = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userPrompt,
            objectId: selObj.id,
            objectName: selObj.name,
            mcpAgentModeEnabled: false
          }),
        });

        if (!response.ok) {
          throw new Error('Une erreur est survenue lors de la communication avec l\'assistant.');
        }

        const data = await response.json();

        // Execute modeling action on the 3D mesh
        if (data.action && data.action !== 'unknown') {
          editorStore.applyAIAction(data.action, data.value, data.color);
        }

        setMessages(prev => [
          ...prev, 
          { 
            sender: 'ai', 
            text: data.message || "Opération terminée avec succès.",
            actionApplied: data.action !== 'unknown' ? data.action : undefined
          }
        ]);
        setIsSending(false);
        return;
      }

      // -------------------------------------------------------------
      // MCP AGENT LOOP: Supports sequence/multi-step tool calls
      // -------------------------------------------------------------
      // Append new user message to chat history
      currentHistory.push({
        role: 'user',
        parts: [{ text: userPrompt }]
      });

      let loopCount = 0;
      const maxLoops = 6; // Safety bounds
      let finalAiResponse = "";

      while (loopCount < maxLoops) {
        loopCount++;

        const response = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            objectId: selObj.id,
            objectName: selObj.name,
            mcpAgentModeEnabled: true,
            contents: currentHistory,
            customApiKey: editorStore.mcpApiKey
          }),
        });

        if (!response.ok) {
          throw new Error('Erreur lors de l\'appel au serveur d\'orchestration MCP.');
        }

        const data = await response.json();
        const functionCalls = data.functionCalls || [];
        const messageText = data.message || "";

        if (functionCalls.length > 0) {
          // Inform user of operations being executed in sequence
          const callsDesc = functionCalls.map((c: any) => `🔨 ${c.name}`).join(', ');
          setMessages(prev => [
            ...prev,
            { sender: 'ai', text: `⚙️ [Agent MCP] Actions détectées : ${callsDesc}. Exécution en cours...` }
          ]);

          const results: any[] = [];
          const modifiedObjectIds = new Set<string>();

          for (const call of functionCalls) {
            // Execute the action via handleAgentAction (handles try/catch internally)
            const actionResult = await editorStore.handleAgentAction(call.name, call.args);
            results.push({ result: actionResult });

            // Trace object target to force refresh at the end
            if (actionResult.status === 'success' && actionResult.data?.objectId) {
              modifiedObjectIds.add(actionResult.data.objectId);
            } else if (call.args.targetObjectId) {
              modifiedObjectIds.add(call.args.targetObjectId);
            }
          }

          // Optimizied rendering update: refresh only at the end of the action sequence
          modifiedObjectIds.forEach(id => {
            editorStore.forceAgentRefresh(id);
          });

          // Register model tool calls in chat history
          currentHistory.push({
            role: 'model',
            parts: [{ functionCalls }]
          });

          // Register tool execution responses in chat history
          currentHistory.push({
            role: 'user',
            parts: [{
              functionResponses: functionCalls.map((c: any, index: number) => ({
                name: c.name,
                response: results[index]
              }))
            }]
          });

          // Loop back to Gemini with the feedback responses to proceed
          continue;
        } else {
          // No more tool requests, conversational text explanation was received
          finalAiResponse = messageText;
          currentHistory.push({
            role: 'model',
            parts: [{ text: finalAiResponse }]
          });
          break;
        }
      }

      setChatHistory(currentHistory);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: finalAiResponse || "Toutes les étapes demandées ont été appliquées avec succès !"
        }
      ]);

    } catch (error: any) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Erreur Agent: ${error.message || 'Impossible de joindre le service de modélisation.'}`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end gap-3 select-none pointer-events-auto">
      {/* 1. Floating AI Chat Dialog Card (Sleek light-themed style inspired by screenshot) */}
      {isOpen && (
        <div 
          id="ai-chat-dialog"
          className="w-96 max-w-[calc(100vw-2rem)] bg-[#F8FAFC] text-slate-800 rounded-3xl shadow-2xl p-4 border border-slate-200 flex flex-col gap-3 font-sans transition-all duration-300 transform origin-bottom-right"
        >
          {/* Header & Object Context Anchor Badge */}
          <div className="flex items-center justify-between">
            <div className="relative group">
              {/* Thumbnail Badge (Captured context) */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm text-[11px] font-semibold text-slate-700 animate-pulse-once">
                <Box className="w-3.5 h-3.5 text-blue-600" />
                <span>{selObj.name}</span>
                <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-bold">
                  Ancré
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 transition-colors"
              title="Fermer le chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conversation History */}
          {messages.length > 0 && (
            <div className="max-h-48 overflow-y-auto px-1 space-y-3 scrollbar-thin">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div 
                    className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      msg.sender === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.actionApplied && (
                    <span className="text-[9px] text-blue-600 font-bold mt-1 px-1.5 py-0.5 bg-blue-50 rounded-full border border-blue-100 uppercase tracking-wider">
                      ★ Action: {msg.actionApplied}
                    </span>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex items-center gap-1.5 text-slate-400 text-xs pl-2">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                  <span>PolyCraft IA analyse et modélise...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Prompt Saisie Area */}
          <div className="relative flex flex-col bg-white border border-slate-200 rounded-2xl p-2 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: 'extrude cet objet de 0.8' ou 'subdivise'..."
              rows={3}
              className="w-full resize-none bg-transparent text-slate-800 placeholder-slate-400 text-xs leading-relaxed focus:outline-none focus:ring-0 border-0 p-1"
            />

            {/* Prompt Actions Footer Row */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
              <button 
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full h-8 w-8 flex items-center justify-center cursor-pointer transition-colors"
                title="Ajouter une pièce jointe (Optionnel)"
              >
                <Plus className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                <button 
                  className="text-slate-400 hover:text-slate-600 rounded-full h-8 w-8 flex items-center justify-center cursor-pointer transition-colors"
                  title="Entrée vocale"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!prompt.trim() || isSending}
                  className={`rounded-full h-9 w-9 flex items-center justify-center cursor-pointer transition-all ${
                    prompt.trim() && !isSending 
                      ? 'bg-slate-950 text-white hover:bg-slate-900 shadow-md' 
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                  title="Envoyer la commande de modélisation (Entrée)"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Circular Floating Chat Button with beautiful click feedback and animation */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-full h-14 w-14 flex items-center justify-center shadow-2xl transition-all duration-300 transform scale-100 hover:scale-105 active:scale-95 ${
          isOpen
            ? 'bg-rose-500 text-white hover:bg-rose-600'
            : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
        title={isOpen ? "Fermer l'Assistant IA" : "Demander à l'Assistant Modélisation IA"}
      >
        {isOpen ? (
          <X className="w-6 h-6 animate-pulse-once" />
        ) : (
          <MessageSquareCode className="w-6 h-6 animate-pulse-once" />
        )}
      </button>
    </div>
  );
}

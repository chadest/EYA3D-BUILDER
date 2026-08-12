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
  const [mcpSocketStatus, setMcpSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);

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

  // Connect to the local MCP server over SSE or WebSocket when Agent Mode is enabled
  useEffect(() => {
    if (!editorStore.mcpAgentModeEnabled) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setMcpSocketStatus('disconnected');
      return;
    }

    const mcpUrl = editorStore.mcpServerUrl || 'http://localhost:3001/mcp';
    setMcpSocketStatus('connecting');

    const handleIncomingMcpMessage = async (dataStr: string) => {
      try {
        const payload = JSON.parse(dataStr);
        console.log("[MCP Client] Message reçu du serveur local:", payload);

        let toolName = "";
        let toolArgs: any = null;
        let requestId: any = null;

        // Support both JSON-RPC tool calling and direct actions
        if (payload.method === 'tools/call' || payload.method === 'call_tool') {
          toolName = payload.params?.name;
          toolArgs = payload.params?.arguments;
          requestId = payload.id;
        } else if (payload.action) {
          toolName = payload.action;
          toolArgs = payload;
          requestId = payload.id;
        }

        if (toolName) {
          console.log(`[MCP Client] Interception de la commande : ${toolName}`, toolArgs);
          
          setMessages(prev => [
            ...prev,
            { sender: 'ai', text: `🔌 [MCP Local] Commande reçue : "${toolName}" sur l'objet...` }
          ]);

          // Execute modeling action on Three.js geometry/material via our handler
          const actionResult = await editorStore.handleAgentAction(toolName, toolArgs);
          
          // Target object ID to force instant graphic updates
          const targetId = toolArgs.targetObjectId || selObj?.id;
          if (targetId) {
            editorStore.forceAgentRefresh(targetId);
          }

          // Generate success/feedback packet for the MCP server
          const ackMsg = {
            jsonrpc: "2.0",
            id: requestId || "ack",
            result: {
              status: "success",
              message: `Action '${toolName}' appliquée avec succès dans la scène PolyCraft.`,
              data: actionResult
            }
          };

          // Send positive acknowledgment back to close the loop
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(ackMsg));
            console.log("[MCP Client] Envoyé réponse positive au serveur (WS):", ackMsg);
          } else {
            try {
              await fetch(`${mcpUrl}/response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ackMsg)
              });
              console.log("[MCP Client] Envoyé réponse positive via POST (SSE):", ackMsg);
            } catch (err) {
              console.warn("[MCP Client] Impossible d'envoyer la réponse de retour (SSE) :", err);
            }
          }

          setMessages(prev => [
            ...prev,
            { sender: 'ai', text: `✅ [MCP Local] "${toolName}" appliqué et rafraîchi sous vos yeux.` }
          ]);
        }
      } catch (err) {
        console.error("[MCP Client] Erreur lors du parsing du message MCP:", err);
      }
    };

    if (mcpUrl.startsWith('ws://') || mcpUrl.startsWith('wss://')) {
      const socket = new WebSocket(mcpUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("[MCP Client] WebSocket connecté à", mcpUrl);
        setMcpSocketStatus('connected');
        
        // Push initial scene graph state so the local agent can discover the inspectable names
        const sceneContext = {
          type: "scene_state",
          event: "scene_initialized",
          objects: editorStore.objects.map(o => ({
            id: o.id,
            name: o.name,
            visible: o.visible,
            wireframe: o.wireframe,
            materialProps: o.materialProps
          })),
          selectedObjectId: editorStore.selectedObjectId
        };
        socket.send(JSON.stringify(sceneContext));
      };

      socket.onmessage = (event) => {
        handleIncomingMcpMessage(event.data);
      };

      socket.onerror = (err) => {
        console.warn("[MCP Client] Erreur WebSocket local:", err);
        setMcpSocketStatus('disconnected');
      };

      socket.onclose = () => {
        console.log("[MCP Client] WebSocket déconnecté.");
        setMcpSocketStatus('disconnected');
      };
    } else {
      // Standard SSE (EventSource) client
      try {
        const eventSource = new EventSource(`${mcpUrl}/sse`);
        sseRef.current = eventSource;

        eventSource.onopen = () => {
          console.log("[MCP Client] SSE connecté à", mcpUrl);
          setMcpSocketStatus('connected');
          
          // Push initial scene state
          fetch(mcpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: "scene_state",
              objects: editorStore.objects.map(o => ({
                id: o.id,
                name: o.name,
                visible: o.visible,
                wireframe: o.wireframe,
                materialProps: o.materialProps
              }))
            })
          }).catch(err => console.warn("[MCP Client] Échec d'envoi de l'état initial SSE :", err));
        };

        eventSource.onmessage = (event) => {
          handleIncomingMcpMessage(event.data);
        };

        eventSource.onerror = (err) => {
          console.warn("[MCP Client] Perte de connexion SSE, reconnexion automatique...", err);
        };
      } catch (err) {
        console.warn("[MCP Client] Échec d'initialisation SSE:", err);
        setMcpSocketStatus('disconnected');
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [editorStore.mcpAgentModeEnabled, editorStore.mcpServerUrl, editorStore.objects, editorStore.selectedObjectId]);

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

      // If MCP is enabled AND we are connected to the local server, transmit directly to it
      if (mcpSocketStatus === 'connected') {
        const mcpRequest = {
          jsonrpc: "2.0",
          method: "chat/message",
          params: {
            message: userPrompt,
            sceneState: {
              objects: editorStore.objects.map(o => ({
                id: o.id,
                name: o.name,
                visible: o.visible,
                wireframe: o.wireframe,
                materialProps: o.materialProps
              })),
              selectedObjectId: selObj.id
            }
          }
        };

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify(mcpRequest));
          console.log("[MCP Client] Envoyé message utilisateur au serveur local (WS):", mcpRequest);
        } else {
          const mcpUrl = editorStore.mcpServerUrl || 'http://localhost:3001/mcp';
          await fetch(mcpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mcpRequest)
          });
          console.log("[MCP Client] Envoyé message utilisateur au serveur local via POST (SSE):", mcpRequest);
        }

        setMessages(prev => [
          ...prev,
          { sender: 'ai', text: "📡 Message transmis au serveur MCP local. En attente de l'agent..." }
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
            parts: functionCalls.map((c: any) => ({
              functionCall: {
                name: c.name,
                args: c.args
              }
            }))
          });

          // Register tool execution responses in chat history
          currentHistory.push({
            role: 'user',
            parts: functionCalls.map((c: any, index: number) => ({
              functionResponse: {
                name: c.name,
                response: results[index]
              }
            }))
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
                {editorStore.mcpAgentModeEnabled && (
                  <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded font-bold ${
                    mcpSocketStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : mcpSocketStatus === 'connecting'
                      ? 'bg-amber-50 text-amber-600 border border-amber-100'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      mcpSocketStatus === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : mcpSocketStatus === 'connecting'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-slate-400'
                    }`} />
                    MCP {mcpSocketStatus === 'connected' ? 'En ligne' : mcpSocketStatus === 'connecting' ? 'Connexion...' : 'Hors ligne'}
                  </span>
                )}
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

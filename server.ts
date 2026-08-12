import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize the modern @google/genai SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// AI Chat endpoint for modeling commands and help
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, objectName, objectId, mcpAgentModeEnabled, contents, customApiKey } = req.body;

    if (!message && !contents) {
      res.status(400).json({ error: "Message or contents is required." });
      return;
    }

    // Instanciate customized AI client if user provided their secure key, fallback to env variable
    const activeAi = customApiKey && customApiKey.trim() !== ""
      ? new GoogleGenAI({
          apiKey: customApiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        })
      : ai;

    if (mcpAgentModeEnabled) {
      const mcpTools = [
        {
          name: "create_primitive",
          description: "Crée une primitive 3D (un cube, une sphère, ou une pyramide) à une position donnée avec des dimensions données.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              shape: {
                type: Type.STRING,
                description: "Forme de la primitive : 'cube', 'sphere', ou 'pyramid'."
              },
              position: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Position [x, y, z] du centre de la primitive dans l'espace 3D."
              },
              size: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Taille de l'objet : [largeur, hauteur, profondeur] pour un cube, [rayon] pour une sphère, [rayon, hauteur] pour une pyramide."
              }
            },
            required: ["shape"]
          }
        },
        {
          name: "extrude_face",
          description: "Extrude une face spécifique d'un objet 3D d'une certaine distance.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetObjectId: {
                type: Type.STRING,
                description: "ID de l'objet 3D cible dans la scène."
              },
              faceIndex: {
                type: Type.INTEGER,
                description: "Index de la face à extruder (0, 1, 2, ...)."
              },
              distance: {
                type: Type.NUMBER,
                description: "Distance de l'extrusion (défaut : 0.5)."
              }
            },
            required: ["targetObjectId", "faceIndex"]
          }
        },
        {
          name: "apply_subdivision",
          description: "Applique un modificateur de subdivision de surface (lissage de maillage) à un objet 3D.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetObjectId: {
                type: Type.STRING,
                description: "ID de l'objet 3D cible."
              },
              levels: {
                type: Type.INTEGER,
                description: "Niveaux de subdivision (compris entre 1 et 3)."
              }
            },
            required: ["targetObjectId", "levels"]
          }
        },
        {
          name: "modify_transform",
          description: "Applique une translation (déplacement) ou une rotation à un objet 3D dans l'espace.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetObjectId: {
                type: Type.STRING,
                description: "ID de l'objet 3D cible."
              },
              type: {
                type: Type.STRING,
                description: "Type de transformation : 'translate' ou 'rotate'."
              },
              values: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Valeurs [x, y, z] de déplacement ou d'angle de rotation (en radians)."
              }
            },
            required: ["targetObjectId", "type", "values"]
          }
        }
      ];

      const response = await activeAi.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contents || [{ role: "user", parts: [{ text: message }] }],
        config: {
          systemInstruction: `You are PolyCraft AI MCP Agent, a highly capable 3D modeling orchestrator.
The user is currently editing an active 3D workspace.
Active Object Name: "${objectName || "None"}" (ID: ${objectId || "None"})

When the user asks you to perform modeling operations, use the provided MCP tools to complete the request.
You can execute multiple tools in sequence (e.g. first create a cube, then translate it, then extrude a face).
Always explain what you are doing in French in a helpful, conversational manner. If a tool call fails, analyze the error returned by the system and try to fix your arguments in the next turn.`,
          tools: [{ functionDeclarations: mcpTools }]
        }
      });

      res.json({
        action: "mcp",
        message: response.text || "",
        functionCalls: response.functionCalls || []
      });
      return;
    }

    const systemPrompt = `You are PolyCraft AI, an intelligent 3D modeling assistant integrated into PolyCraft 3D Studio.
The user is currently editing an active 3D object in their workspace.
Active Object Name: "${objectName || "None"}" (ID: ${objectId || "None"})

Your task is to analyze the user's natural language modeling request and determine if it maps to any of the supported 3D modeling actions:
- 'extrude': Extruding the selected faces. Optional 'value' (e.g. extrude distance, defaults to 0.5 if not specified, positive decimal).
- 'inset': Insetting the selected faces. Optional 'value' (e.g. inset amount, defaults to 0.15, positive decimal).
- 'bevel': Beveling the selected faces. Optional 'value' (e.g. width, defaults to 0.1, positive decimal).
- 'subdivide': Increasing the subdivision levels of the mesh or toggling subdivision. Optional 'value' (e.g. level, defaults to 1).
- 'color': Changing the material color of the active object. Requires a hex code in the 'color' field (e.g. "#FF5733").
- 'unknown': If it's a general question, explanation request, or does not match any direct action.

You must reply with a structured JSON object containing:
1. "action": One of the action strings: "extrude", "inset", "bevel", "subdivide", "color", or "unknown".
2. "value": A positive number for the operation value (if applicable).
3. "color": A hex color string starting with # (only if action is "color").
4. "message": A polite, concise, and helpful conversational response in French explaining what action is being performed, or providing a helpful answer/tips about 3D modeling if no direct action was identified.

Examples:
- "Extrude cet objet de 0.8" -> { "action": "extrude", "value": 0.8, "message": "J'extrude les faces sélectionnées de l'objet de 0.8 unités." }
- "Applique une subdivision" -> { "action": "subdivide", "value": 1, "message": "J'applique un modificateur de subdivision de niveau 1 pour lisser le maillage." }
- "Change la couleur en rouge vif" -> { "action": "color", "color": "#FF0000", "message": "Je change la couleur de l'objet en rouge vif (#FF0000)." }
- "Comment faire un biseau ?" -> { "action": "unknown", "message": "Pour faire un biseau, sélectionnez les faces souhaitées dans le Viewport, puis cliquez sur l'icône de Bevel dans la barre d'outils, ou demandez-moi simplement 'fais un biseau de 0.2' !" }`;

    const response = await activeAi.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              description: "The modeling action: 'extrude', 'inset', 'bevel', 'subdivide', 'color', or 'unknown'."
            },
            value: {
              type: Type.NUMBER,
              description: "Numeric parameter value for the action (distance, amount, level)."
            },
            color: {
              type: Type.STRING,
              description: "Color hex string starting with # (e.g. #3b82f6) for color action."
            },
            message: {
              type: Type.STRING,
              description: "Conversational explanation or answer in French."
            }
          },
          required: ["action", "message"]
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ 
      error: "Error processing your request", 
      message: error.message || String(error) 
    });
  }
});

// Configure Vite integration for SPA fallback & asset bundling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

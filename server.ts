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
        },
        {
          name: "update_object",
          description: "Met à jour une propriété de transformation ou d'affichage d'un objet 3D (comme sa position, sa rotation ou son échelle).",
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetObjectId: {
                type: Type.STRING,
                description: "ID de l'objet 3D cible."
              },
              property: {
                type: Type.STRING,
                description: "Propriété de transformation ou d'état : 'position', 'rotation', 'scale', 'visible'."
              },
              value: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Nouvelle valeur. Tableau [x, y, z] pour 'position', 'rotation' ou 'scale'. S'il s'agit de la visibilité, envoyer [1] pour visible, [0] pour invisible."
              }
            },
            required: ["targetObjectId", "property", "value"]
          }
        },
        {
          name: "set_material_property",
          description: "Modifie une propriété de matériau d'un objet 3D (comme la couleur, la rugosité ou la brillance).",
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetObjectId: {
                type: Type.STRING,
                description: "ID de l'objet 3D cible."
              },
              property: {
                type: Type.STRING,
                description: "Propriété à modifier : 'color' (couleur hexadécimale), 'roughness' (rugosité entre 0 et 1), 'metalness' (métallisation entre 0 et 1), 'opacity' (opacité entre 0 et 1), ou 'wireframe' ('true' ou 'false')."
              },
              value: {
                type: Type.STRING,
                description: "Nouvelle valeur sous forme de chaîne de caractères (ex: '#FF0000', '0.5', 'true')."
              }
            },
            required: ["targetObjectId", "property", "value"]
          }
        }
      ];

      const response = await activeAi.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contents || [{ role: "user", parts: [{ text: message }] }],
        config: {
          systemInstruction: `You are Eya3D AI MCP Agent, a highly capable 3D modeling orchestrator.
The user is currently editing an active 3D workspace.
Active Object Name: "${objectName || "None"}" (ID: ${objectId || "None"})

When the user asks you to perform modeling operations, use the provided MCP tools to complete the request.
You can execute multiple tools in sequence (e.g. first create a cube, then translate it, then extrude a face).

CRITICAL INSTRUCTIONS AGAINST VOXELIZATION / LEGO EFFECT:
1. NO VOXELIZATION (Interdiction des Primitives Multiples):
   It is STRICTLY FORBIDDEN to generate multiple small cubic geometries (voxels) or stack separate cubes to simulate an object (Minecraft or LEGO style). A solid shape must be represented by A SINGLE global mesh (THREE.Mesh).
2. SMOOTH POLYGONAL SURFACES:
   When writing scripts or creating/recommending mesh constructions, ensure you utilize shared-vertex indices (declaring a unified array of vertices connected by geometry.index), sharing edges to form a smooth continuous polygonal surface.
3. SMOOTH SHADING & NORMALS:
   Always compute normals systematically using 'geometry.computeVertexNormals()' after any modification to active geometry, and configure materials with smooth rendering properties (e.g., standard roughness and metalness) to avoid faceted shading.

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

    const systemPrompt = `You are Eya3D AI, an intelligent 3D modeling assistant integrated into Eya3D.
The user is currently editing an active 3D object in their workspace.
Active Object Name: "${objectName || "None"}" (ID: ${objectId || "None"})

Your task is to analyze the user's natural language modeling request and determine if it maps to any of the supported 3D modeling actions:
- 'extrude': Extruding the selected faces. Optional 'value' (e.g. extrude distance, defaults to 0.5 if not specified, positive decimal).
- 'inset': Insetting the selected faces. Optional 'value' (e.g. inset amount, defaults to 0.15, positive decimal).
- 'bevel': Beveling the selected faces. Optional 'value' (e.g. width, defaults to 0.1, positive decimal).
- 'subdivide': Increasing the subdivision levels of the mesh or toggling subdivision. Optional 'value' (e.g. level, defaults to 1).
- 'color': Changing the material color of the active object. Requires a hex code in the 'color' field (e.g. "#FF5733").
- 'unknown': If it's a general question, explanation request, or does not match any direct action.

CRITICAL INSTRUCTIONS AGAINST VOXELIZATION / LEGO EFFECT:
1. NO VOXELIZATION (Interdiction des Primitives Multiples):
   It is STRICTLY FORBIDDEN to create shapes by stack-building multiple individual BoxGeometries (no voxelized, Minecraft, or LEGO style). Any generated solid or custom scripts must consist of a SINGLE mesh and geometry.
2. CONTINUOUS INDEXED GEOMETRY (Utilisation d'Index Géométriques Partagés):
   Ensure vertex sharing via index tables (geometry.index / shared coordinates) is used for smooth, traditional polygonal shapes.
3. SYSTEMATIC NORMALS CALCULATIONS:
   All operations must compute normals via 'geometry.computeVertexNormals()' for smooth shading.

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

// AI Script generator endpoint - generates smooth, non-voxelized Three.js scripts
app.post("/api/gemini/generate-script", async (req, res) => {
  try {
    const { prompt, customApiKey } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
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

    const systemInstruction = `You are Eya3D Script Generator, an intelligent code author specialized in Three.js geometry construction.
Your task is to write a clean, robust, and optimized JavaScript script to build or deform 3D models inside Eya3D.

The generated script will be evaluated as a function with the following variables injected into its scope:
- 'THREE' (the global Three.js namespace)
- 'scene' (the active THREE.Scene instance)
- 'selectedModel' (the currently selected THREE.Mesh or null)
- 'console' (a mock console with log/warn/error functions to stream messages to the terminal)

CRITICAL STRUCTURAL BOUNDARIES (INTERDICTION DES PRIMITIVES MULTIPLES & VOXELISATION):
1. NO VOXELIZATION (Interdiction Formelle de la Voxelisation) :
   It is STRICTLY FORBIDDEN to instantiate multiple individual cubes ('THREE.BoxGeometry') or objects inside loops, or to stack multiple separate primitives to shape a solid model (no Minecraft, LEGO, or voxel block styles). 
   A solid shape must consist of ONE SINGLE unified 'THREE.Mesh' with ONE single, continuous, fully custom 'THREE.BufferGeometry'.
2. SHARED GEOMETRIC INDEXING (Utilisation d'Index Géométriques Partagés) :
   To create high-quality, smooth continuous surfaces, you must define a unified array of vertices ('positions' in a Float32Array) and interconnect them via an index table ('indices' inside geometry.setIndex). Triangles must share their edges to form smooth joints instead of isolated, faceted flat planes.
3. MANDATORY NORMALS COMPUTATION & SMOOTH SHADING (Calcul Obligatoire des Normales) :
   You MUST systematically call 'geometry.computeVertexNormals()' after building the custom geometry to active smooth-shading rendering on the GPU. 
   Set material properties coherently (e.g., 'roughness: 0.4', 'metalness: 0.1') for a smooth, high-fidelity finish. Do NOT use flat shading.
4. SCENE INSERTION :
   Create a standard 'THREE.Mesh', assign a descriptive, unique name to it (e.g. mesh.name = "Custom Smooth Object"), and add it directly to the 'scene'.
   Example:
   const geometry = new THREE.BufferGeometry();
   const vertices = new Float32Array([...]);
   const indices = [...];
   geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
   geometry.setIndex(indices);
   geometry.computeVertexNormals();
   const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35, metalness: 0.15 });
   const mesh = new THREE.Mesh(geometry, material);
   mesh.name = "My Smooth Mesh";
   scene.add(mesh);
   console.log("Objet polygonal continu créé !");

Provide ONLY the raw JavaScript executable code. Do NOT enclose the code in markdown backticks (such as \`\`\`javascript). Do NOT include any intro, outro, explanatory paragraphs or conversational prose. Only output clean, ready-to-run JavaScript.`;

    const response = await activeAi.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    let code = response.text || "";
    // Sanitize any markdown wrappers if returned
    code = code.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();

    res.json({ code });
  } catch (error: any) {
    console.error("Error generating script:", error);
    res.status(500).json({ 
      error: "Error generating the 3D script.", 
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

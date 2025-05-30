/// <reference types="@figma/plugin-typings" />

// Types
interface FramePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  isFavorite: boolean;
  dateCreated: number;

  // Additional frame properties
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  cornerRadius?: number | number[];
  effects?: Effect[];
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  primaryAxisSizingMode?: "FIXED" | "AUTO";
  counterAxisSizingMode?: "FIXED" | "AUTO";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  clipsContent?: boolean;
}

interface Collection {
  id: string;
  name: string;
  presets: FramePreset[];
  isBuiltIn?: boolean;
}

interface PluginData {
  collections: Collection[];
  activeCollectionId: string | null;
  lastSyncedAt?: number;
}

interface PluginMessage {
  type: string;
  [key: string]: any;
}

// IDs of built-in collections that should be preserved during sync operations
const BUILT_IN_COLLECTION_IDS = [
  "instagram",
  "facebook",
  "twitter",
  "youtube",
  "figma",
];

// Initial data with built-in collections
const defaultCollections: Collection[] = [
  {
    id: "instagram",
    name: "Instagram",
    presets: [
      {
        id: "instagram-post",
        name: "Post",
        width: 1080,
        height: 1080,
        isFavorite: false,
        dateCreated: Date.now(),
      },
      {
        id: "instagram-story",
        name: "Story",
        width: 1080,
        height: 1920,
        isFavorite: false,
        dateCreated: Date.now(),
      },
    ],
    isBuiltIn: true,
  },
  {
    id: "twitter",
    name: "Twitter",
    presets: [
      {
        id: "twitter-post",
        name: "Post",
        width: 1200,
        height: 675,
        isFavorite: false,
        dateCreated: Date.now(),
      },
      {
        id: "twitter-header",
        name: "Header",
        width: 1500,
        height: 500,
        isFavorite: false,
        dateCreated: Date.now(),
      },
    ],
    isBuiltIn: true,
  },
  {
    id: "facebook",
    name: "Facebook",
    presets: [
      {
        id: "facebook-post",
        name: "Post",
        width: 1200,
        height: 630,
        isFavorite: false,
        dateCreated: Date.now(),
      },
      {
        id: "facebook-cover",
        name: "Cover",
        width: 820,
        height: 312,
        isFavorite: false,
        dateCreated: Date.now(),
      },
    ],
    isBuiltIn: true,
  },
  {
    id: "print",
    name: "Print Dimensions",
    presets: [
      {
        id: "print-a4",
        name: "A4",
        width: 2480,
        height: 3508,
        isFavorite: false,
        dateCreated: Date.now(),
      },
      {
        id: "print-letter",
        name: "Letter",
        width: 2550,
        height: 3300,
        isFavorite: false,
        dateCreated: Date.now(),
      },
    ],
    isBuiltIn: true,
  },
];

// Hardcoded Supabase configuration - these will be used for all users
const SUPABASE_CONFIG = {
  url: "https://mrtcubtbzefdjvnnghen.supabase.co",  // Replace with your actual Supabase project URL
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydGN1YnRiemVmZGp2bm5naGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzNDIwOTMsImV4cCI6MjA2MTkxODA5M30.yH2jGdHR7wHHyyBJy2dY-8wgpJl0dd9BDs3JRh_8IgQ"  // Replace with your actual anon/public key
};

// Simple fetch-based Supabase client implementation to avoid the complex library
class SimpleSupabaseClient {
  private url: string;
  private key: string;
  
  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
    console.log(`Created simple Supabase client for ${url.substring(0, 15)}...`);
  }
  
  async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    try {
      const response = await fetch(`${this.url}${endpoint}`, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Supabase fetch error:', error);
      throw error;
    }
  }
  
  from(table: string) {
    return {
      select: async (query: string = "*") => {
        const result = await this.fetchWithAuth(`/rest/v1/${table}?select=${query}`);
        return { data: result, error: null };
      },
      upsert: async (data: any) => {
        try {
          const result = await this.fetchWithAuth(`/rest/v1/${table}`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Prefer': 'resolution=merge-duplicates' }
          });
          return { data: result, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      delete: () => {
        return {
          not: async (column: string, operator: string, value: string[]) => {
            try {
              // Use the operator parameter in the query string
              let queryParam = "";
              
              if (operator === "in") {
                // Handle "not in" case
                const notInQuery = value.map(v => `"${v}"`).join(',');
                queryParam = `${column}=not.in.(${notInQuery})`;
              } else {
                // Handle other operators if needed
                queryParam = `${column}=not.${operator}.(${value.join(',')})`;
              }
              
              const result = await this.fetchWithAuth(
                `/rest/v1/${table}?${queryParam}`,
                { method: 'DELETE' }
              );
              return { data: result, error: null };
            } catch (error) {
              return { data: null, error };
            }
          }
        };
      }
    };
  }
}

// Initialize Supabase client
let supabaseClient: SimpleSupabaseClient | null = null;

async function syncWithSupabase(data: PluginData): Promise<boolean> {
  if (!supabaseClient) {
    try {
      // Initialize the client with hardcoded config
      supabaseClient = new SimpleSupabaseClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

      // Test the connection
      const { error: testError } = await supabaseClient
        .from("collections")
        .select("*");

      if (testError) throw testError;
      
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error);
      throw error;
    }
  }

  try {
    // First delete all existing collections for this user to ensure clean slate
    // This makes sync a true force-replace operation
    const { error: deleteError } = await supabaseClient
      .from("collections")
      .delete()
      .not("id", "in", BUILT_IN_COLLECTION_IDS); // Preserve built-in collections

    if (deleteError) {
      console.error("Error deleting old collections:", deleteError);
      throw deleteError;
    }

    // Now insert all collections
    const { error } = await supabaseClient.from("collections").upsert(
      data.collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        presets: collection.presets,
        is_built_in: collection.isBuiltIn || false,
        last_synced_at: new Date().toISOString(),
      }))
    );

    if (error) throw error;

    // Update last sync time
    data.lastSyncedAt = Date.now();
    await savePluginData(data);

    console.log("Successfully synced all collections to Supabase");
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    throw error;
  }
}

// Initialize plugin
figma.showUI(__html__, { width: 320, height: 480 });

// Main function to initialize the plugin
async function initializePlugin() {
  try {
    // First try to load existing data from storage
    const existingData = await figma.clientStorage.getAsync("framePresetsData");
    
    if (existingData) {
      // If we have existing data, use it
      console.log("Loaded existing plugin data:", existingData);
      
      // Send existing data to the UI
      figma.ui.postMessage({
        type: "init",
        data: existingData,
      });
    } else {
      // If no existing data, initialize with defaults
      const initialData: PluginData = {
        collections: defaultCollections,
        activeCollectionId: "instagram",
      };

      // Save the default data to client storage
      await savePluginData(initialData);

      console.log("Initialized plugin with default data:", initialData);

      // Send initial data to the UI
      figma.ui.postMessage({
        type: "init",
        data: initialData,
      });
    }

    // Store the hardcoded Supabase config
    await figma.clientStorage.setAsync("supabaseConfig", SUPABASE_CONFIG);

    // Also send Supabase config
    figma.ui.postMessage({
      type: "supabase-config",
      config: SUPABASE_CONFIG
    });
  } catch (error) {
    console.error("Error initializing plugin data:", error);
  }
}

// Create a new frame with preset dimensions and properties
function createFrame(preset: FramePreset) {
  const frame = figma.createFrame();
  frame.resize(preset.width, preset.height);
  frame.name = preset.name;

  // Apply all additional frame properties if they exist in the preset
  if (preset.fills) frame.fills = preset.fills as Paint[];
  if (preset.strokes) frame.strokes = preset.strokes as Paint[];
  if (preset.strokeWeight !== undefined)
    frame.strokeWeight = preset.strokeWeight;
  if (preset.cornerRadius !== undefined) {
    if (Array.isArray(preset.cornerRadius)) {
      // Use type assertion to avoid TypeScript errors with cornerRadius array
      (frame as any).cornerRadius = preset.cornerRadius;
    } else {
      frame.cornerRadius = preset.cornerRadius;
    }
  }
  if (preset.effects) frame.effects = preset.effects as Effect[];
  if (preset.layoutMode) frame.layoutMode = preset.layoutMode;
  if (preset.primaryAxisSizingMode)
    frame.primaryAxisSizingMode = preset.primaryAxisSizingMode;
  if (preset.counterAxisSizingMode)
    frame.counterAxisSizingMode = preset.counterAxisSizingMode;
  if (preset.primaryAxisAlignItems)
    frame.primaryAxisAlignItems = preset.primaryAxisAlignItems;
  if (preset.counterAxisAlignItems)
    frame.counterAxisAlignItems = preset.counterAxisAlignItems;
  if (preset.paddingLeft !== undefined) frame.paddingLeft = preset.paddingLeft;
  if (preset.paddingRight !== undefined)
    frame.paddingRight = preset.paddingRight;
  if (preset.paddingTop !== undefined) frame.paddingTop = preset.paddingTop;
  if (preset.paddingBottom !== undefined)
    frame.paddingBottom = preset.paddingBottom;
  if (preset.itemSpacing !== undefined) frame.itemSpacing = preset.itemSpacing;
  if (preset.clipsContent !== undefined)
    frame.clipsContent = preset.clipsContent;

  // Center the frame in the viewport
  const viewportCenter = figma.viewport.center;
  frame.x = viewportCenter.x - preset.width / 2;
  frame.y = viewportCenter.y - preset.height / 2;

  // Select the newly created frame
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  return frame;
}

// Save current plugin data to client storage
async function savePluginData(data: PluginData) {
  await figma.clientStorage.setAsync("framePresetsData", data);
}

// Handle messages from the UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  // Handle different message types from the UI
  switch (msg.type) {
    case "create-preset":
      // Get the currently selected frames
      const selectedFrames = figma.currentPage.selection.filter(
        (node): node is FrameNode => node.type === "FRAME"
      );

      if (selectedFrames.length === 0) {
        figma.notify("Please select at least one frame to create a preset");
        return;
      }

      // Check if there are any active custom collections
      const checkData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      // Filter out built-in collections
      const customCollections = checkData.collections.filter(
        (c) => !c.isBuiltIn
      );

      // If no custom collections exist, prompt to create one first
      if (customCollections.length === 0) {
        figma.ui.postMessage({
          type: "no-custom-collections",
          message: "Please create a collection first to save presets",
        });
        return;
      }

      // Determine target collection (use active collection or first custom collection)
      const targetCollectionId = msg.targetCollectionId || 
                                (checkData.activeCollectionId && 
                                 !checkData.collections.find(c => c.id === checkData.activeCollectionId)?.isBuiltIn ? 
                                 checkData.activeCollectionId : customCollections[0].id);
      
      // For now, handle only the first frame for simplicity if multiple are selected
      const frame = selectedFrames[0];
      
      // Instead of asking for a name directly in Figma, we'll send a message to the UI
      figma.ui.postMessage({
        type: "inline-name-edit",
        frameName: frame.name,
        frameWidth: frame.width,
        frameHeight: frame.height,
        targetCollectionId: targetCollectionId,
        frameProps: {
          fills: JSON.parse(JSON.stringify(frame.fills || [])),
          strokes: JSON.parse(JSON.stringify(frame.strokes || [])),
          strokeWeight: Number(frame.strokeWeight),
          cornerRadius: typeof frame.cornerRadius === "object"
            ? JSON.parse(JSON.stringify(frame.cornerRadius))
            : frame.cornerRadius,
          effects: JSON.parse(JSON.stringify(frame.effects || [])),
          layoutMode: frame.layoutMode,
          primaryAxisSizingMode: frame.primaryAxisSizingMode,
          counterAxisSizingMode: frame.counterAxisSizingMode,
          primaryAxisAlignItems: frame.primaryAxisAlignItems,
          counterAxisAlignItems: frame.counterAxisAlignItems === "MIN" || 
                                frame.counterAxisAlignItems === "CENTER" || 
                                frame.counterAxisAlignItems === "MAX" ? 
                                frame.counterAxisAlignItems : "CENTER",
          paddingLeft: frame.paddingLeft,
          paddingRight: frame.paddingRight,
          paddingTop: frame.paddingTop,
          paddingBottom: frame.paddingBottom,
          itemSpacing: frame.itemSpacing,
          clipsContent: frame.clipsContent,
        }
      });
      break;
      
    case "save-frame-with-name":
      // This is a new message type for saving a frame with an edited name
      if (!msg.frameName || !msg.targetCollectionId) {
        figma.notify("Error: Missing required data for saving frame");
        return;
      }
      
      // Get plugin data again to ensure we have the latest
      const frameSaveData: PluginData = await figma.clientStorage.getAsync("framePresetsData");
      
      // Create the preset with the edited name
      const newPreset: FramePreset = {
        id: `preset-${Date.now()}`,
        name: msg.frameName,
        width: msg.frameWidth,
        height: msg.frameHeight,
        isFavorite: false,
        dateCreated: Date.now(),
        ...msg.frameProps // Spread the frame properties
      };
      
      // Find the target collection
      const frameSaveCollectionIndex = frameSaveData.collections.findIndex(
        c => c.id === msg.targetCollectionId
      );
      
      if (frameSaveCollectionIndex >= 0) {
        // Add preset to the collection
        frameSaveData.collections[frameSaveCollectionIndex].presets.push(newPreset);
        
        // Save updated data
        await savePluginData(frameSaveData);
        
        // Send updated data to UI
        figma.ui.postMessage({
          type: "update",
          data: frameSaveData,
        });
        
        // Show success notification
        figma.notify(
          `Saved "${msg.frameName}" to "${frameSaveData.collections[frameSaveCollectionIndex].name}"`
        );
      }
      break;

    case "selection-data":
      // Nothing to handle here - this is a message type sent from the plugin to the UI
      break;

    case "save-preset":
      // Save a new preset to the target collection
      const saveData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const saveCollectionIndex = saveData.collections.findIndex(
        (c) => c.id === msg.collectionId
      );

      if (saveCollectionIndex >= 0) {
        // Check if this is a built-in collection
        if (saveData.collections[saveCollectionIndex].isBuiltIn) {
          figma.notify("Cannot add presets to built-in collections", {
            error: true,
          });
        } else {
          // Only add to custom collections
          saveData.collections[saveCollectionIndex].presets.push(msg.preset);
          await savePluginData(saveData);

          figma.notify(
            `Preset "${msg.preset.name}" saved to collection "${saveData.collections[saveCollectionIndex].name}"`
          );

          // Send updated data back to the UI
          figma.ui.postMessage({
            type: "update",
            data: saveData,
          });
        }
      }
      break;

    case "save-multiple-presets":
      // Save multiple presets to the target collection
      const multiPresetsData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const collectionIndex = multiPresetsData.collections.findIndex(
        (c) => c.id === msg.collectionId
      );

      if (collectionIndex >= 0) {
        // Check if this is a built-in collection
        if (multiPresetsData.collections[collectionIndex].isBuiltIn) {
          figma.notify("Cannot add presets to built-in collections", {
            error: true,
          });
        } else {
          // Add all presets to the collection
          if (Array.isArray(msg.presets) && msg.presets.length > 0) {
            console.log(`Preparing to add ${msg.presets.length} frames`);

            // Create completely independent presets for each frame
            const presetsToAdd = msg.presets.map(
              (preset: FramePreset, index: number) => {
                // Create a new independent object for each preset to avoid any shared references
                const newPreset = {
                  // Core properties
                  id: `preset-${Date.now()}-${index}`, // Ensure unique ID with timestamp and index
                  name: String(preset.name || ""), // Ensure string type
                  width: Number(preset.width), // Ensure number type
                  height: Number(preset.height), // Ensure number type
                  isFavorite: Boolean(preset.isFavorite || false), // Ensure boolean type
                  dateCreated: Number(preset.dateCreated || Date.now()), // Ensure number type

                  // Deep clone frame styling properties to break all object references
                  fills: preset.fills
                    ? JSON.parse(JSON.stringify(preset.fills))
                    : [],
                  strokes: preset.strokes
                    ? JSON.parse(JSON.stringify(preset.strokes))
                    : [],
                  strokeWeight: Number(preset.strokeWeight || 0),
                  cornerRadius:
                    typeof preset.cornerRadius === "object"
                      ? JSON.parse(JSON.stringify(preset.cornerRadius))
                      : Number(preset.cornerRadius || 0),
                  effects: preset.effects
                    ? JSON.parse(JSON.stringify(preset.effects))
                    : [],

                  // Layout properties
                  layoutMode: preset.layoutMode || "NONE",
                  primaryAxisSizingMode:
                    preset.primaryAxisSizingMode || "FIXED",
                  counterAxisSizingMode:
                    preset.counterAxisSizingMode || "FIXED",
                  primaryAxisAlignItems: preset.primaryAxisAlignItems || "MIN",
                  counterAxisAlignItems: preset.counterAxisAlignItems || "MIN",

                  // Padding properties
                  paddingLeft: Number(preset.paddingLeft || 0),
                  paddingRight: Number(preset.paddingRight || 0),
                  paddingTop: Number(preset.paddingTop || 0),
                  paddingBottom: Number(preset.paddingBottom || 0),

                  // Other frame properties
                  itemSpacing: Number(preset.itemSpacing || 0),
                  clipsContent: Boolean(preset.clipsContent || true),
                };

                console.log(
                  `Processed frame ${index}: ${newPreset.name} (${newPreset.width}×${newPreset.height})`
                );

                return newPreset;
              }
            );

            // Add the presets to the collection
            multiPresetsData.collections[collectionIndex].presets.push(
              ...presetsToAdd
            );
            await savePluginData(multiPresetsData);

            figma.notify(
              `Saved ${msg.presets.length} preset${
                msg.presets.length > 1 ? "s" : ""
              } to "${multiPresetsData.collections[collectionIndex].name}"`
            );

            // Send updated data back to the UI
            figma.ui.postMessage({
              type: "update",
              data: multiPresetsData,
            });
          }
        }
      }
      break;

    case "apply-preset":
      // Apply a preset to selected frames or create a new frame
      const applyData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const applyCollection = applyData.collections.find(
        (c) => c.id === msg.collectionId
      );

      if (!applyCollection) {
        figma.notify("Collection not found", { error: true });
        return;
      }

      const presetToApply = applyCollection.presets.find(
        (p) => p.id === msg.presetId
      );

      if (!presetToApply) {
        figma.notify("Preset not found", { error: true });
        return;
      }

      // Check current selection
      const applyToSelection = figma.currentPage.selection.filter(
        (node): node is FrameNode => node.type === "FRAME"
      );

      if (applyToSelection.length > 0) {
        // Apply to selected frames
        applyToSelection.forEach((frame) => {
          // Resize the frame
          frame.resize(presetToApply.width, presetToApply.height);

          // Apply all additional frame properties if they exist in the preset
          if (presetToApply.fills) frame.fills = presetToApply.fills as Paint[];
          if (presetToApply.strokes)
            frame.strokes = presetToApply.strokes as Paint[];
          if (presetToApply.strokeWeight !== undefined)
            frame.strokeWeight = presetToApply.strokeWeight;
          if (presetToApply.cornerRadius !== undefined) {
            if (Array.isArray(presetToApply.cornerRadius)) {
              // Use type assertion to avoid TypeScript errors with cornerRadius array
              (frame as any).cornerRadius = presetToApply.cornerRadius;
            } else {
              frame.cornerRadius = presetToApply.cornerRadius;
            }
          }
          if (presetToApply.effects)
            frame.effects = presetToApply.effects as Effect[];
          if (presetToApply.layoutMode)
            frame.layoutMode = presetToApply.layoutMode;
          if (presetToApply.primaryAxisSizingMode)
            frame.primaryAxisSizingMode = presetToApply.primaryAxisSizingMode;
          if (presetToApply.counterAxisSizingMode)
            frame.counterAxisSizingMode = presetToApply.counterAxisSizingMode;
          if (presetToApply.primaryAxisAlignItems)
            frame.primaryAxisAlignItems = presetToApply.primaryAxisAlignItems;
          if (presetToApply.counterAxisAlignItems)
            frame.counterAxisAlignItems = presetToApply.counterAxisAlignItems;
          if (presetToApply.paddingLeft !== undefined)
            frame.paddingLeft = presetToApply.paddingLeft;
          if (presetToApply.paddingRight !== undefined)
            frame.paddingRight = presetToApply.paddingRight;
          if (presetToApply.paddingTop !== undefined)
            frame.paddingTop = presetToApply.paddingTop;
          if (presetToApply.paddingBottom !== undefined)
            frame.paddingBottom = presetToApply.paddingBottom;
          if (presetToApply.itemSpacing !== undefined)
            frame.itemSpacing = presetToApply.itemSpacing;
          if (presetToApply.clipsContent !== undefined)
            frame.clipsContent = presetToApply.clipsContent;
        });

        figma.notify(
          `Applied "${presetToApply.name}" to ${
            applyToSelection.length
          } selected frame${applyToSelection.length > 1 ? "s" : ""}`
        );
      } else {
        // No frames selected, create a new frame
        createFrame(presetToApply);
        figma.notify(`Created new frame using "${presetToApply.name}" preset`);
      }
      break;

    case "toggle-favorite":
      // Toggle favorite status for a preset
      const favData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const favCollectionIndex = favData.collections.findIndex(
        (c) => c.id === msg.collectionId
      );

      if (favCollectionIndex >= 0) {
        const presetIndex = favData.collections[
          favCollectionIndex
        ].presets.findIndex((p) => p.id === msg.presetId);

        if (presetIndex >= 0) {
          // Toggle the favorite status
          favData.collections[favCollectionIndex].presets[
            presetIndex
          ].isFavorite =
            !favData.collections[favCollectionIndex].presets[presetIndex]
              .isFavorite;

          // Preserve the active collection if specified
          if (msg.preserveActiveCollection) {
            favData.activeCollectionId = msg.preserveActiveCollection;
          }

          await savePluginData(favData);

          figma.ui.postMessage({
            type: "update",
            data: favData,
          });
        }
      }
      break;

    case "clear-plugin-data":
      // Clear all stored data
      await figma.clientStorage.deleteAsync("framePresetsData");
      
      // Re-initialize with default collections
      const stockData: PluginData = {
        collections: defaultCollections,  // This will restore the default built-in collections
        activeCollectionId: "instagram"  // Set a default active collection
      };
      await savePluginData(stockData);
      
      // Reset to hardcoded Supabase config
      await figma.clientStorage.setAsync("supabaseConfig", SUPABASE_CONFIG);
      
      // Notify UI about both updates
      figma.ui.postMessage({
        type: "update",
        data: stockData
      });

      figma.ui.postMessage({
        type: "supabase-config",
        config: SUPABASE_CONFIG
      });

      // Notify user
      console.log("Plugin data has been reset to default state");
      break;

    case "set-active-collection":
      // Change the active collection
      const activeData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );
      activeData.activeCollectionId = msg.collectionId;
      await savePluginData(activeData);

      figma.ui.postMessage({
        type: "update",
        data: activeData,
      });
      break;

    case "create-collection":
      // Create a new collection
      const collectionsData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      // Check if a collection with this name already exists
      const collectionNameExists = collectionsData.collections.some(
        (collection) => collection.name.toLowerCase() === msg.name.toLowerCase()
      );

      if (collectionNameExists) {
        // Send error message back to UI
        figma.ui.postMessage({
          type: "collection-name-exists",
          name: msg.name,
        });
        return;
      }

      // Generate unique ID for the new collection
      const newId = `collection-${Date.now()}`;

      // Add the new collection
      collectionsData.collections.push({
        id: newId,
        name: msg.name,
        presets: [],
      });

      // Set it as the active collection
      collectionsData.activeCollectionId = newId;

      await savePluginData(collectionsData);

      figma.ui.postMessage({
        type: "update",
        data: collectionsData,
      });

      console.log(`Collection "${msg.name}" created`);
      break;

    case "delete-collection":
      // Delete a collection by ID
      const deleteCollectionId = msg.collectionId;
      const deleteData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const deleteCollectionIndex = deleteData.collections.findIndex(
        (c) => c.id === deleteCollectionId
      );

      // Remove the check preventing built-in collections from being deleted
      if (deleteCollectionIndex >= 0) {
        deleteData.collections.splice(deleteCollectionIndex, 1);

        // If deleted collection was the active one, set a new active collection
        if (deleteData.activeCollectionId === deleteCollectionId) {
          if (deleteData.collections.length > 0) {
            deleteData.activeCollectionId = deleteData.collections[0].id;
          } else {
            deleteData.activeCollectionId = null;
          }
        }

        await savePluginData(deleteData);

        figma.ui.postMessage({
          type: "update",
          data: deleteData,
        });

        console.log(`Collection deleted`);
      }
      break;

    case "delete-preset":
      // Delete a preset from a collection
      const presetData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const presetCollectionIndex = presetData.collections.findIndex(
        (c) => c.id === msg.collectionId
      );

      if (presetCollectionIndex >= 0) {
        // Make sure the collection isn't built-in
        if (presetData.collections[presetCollectionIndex].isBuiltIn) {
          figma.notify("Cannot delete presets from built-in collections", {
            error: true,
          });
          return;
        }

        // Filter out the preset to delete
        presetData.collections[presetCollectionIndex].presets =
          presetData.collections[presetCollectionIndex].presets.filter(
            (p) => p.id !== msg.presetId
          );

        await savePluginData(presetData);

        figma.ui.postMessage({
          type: "update",
          data: presetData,
        });
      }
      break;

    case "sync-to-supabase":
      // Handle syncing to Supabase
      const syncData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );
      const success = await syncWithSupabase(syncData);
      if (success) {
        console.log("Syncing to Supabase completed");
      } else {
        console.log("Syncing to Supabase failed");
      }
      break;

    case "import-from-supabase":
      // Handle importing from Supabase (will be implemented in the UI)
      console.log("Importing from Supabase...");
      break;

    case "resize-ui":
      // Resize the UI window
      figma.ui.resize(msg.width, msg.height);
      break;

    case "reorder-collections":
      // Reorder collections based on the new order
      const reorderData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      console.log("Backend received reorder request", msg.collectionIds);
      console.log(
        "Current collections order:",
        reorderData.collections.map((c) => c.id)
      );

      // Validate that we have collection IDs to reorder
      if (
        !msg.collectionIds ||
        !Array.isArray(msg.collectionIds) ||
        msg.collectionIds.length === 0
      ) {
        console.error(
          "Invalid collection IDs for reordering",
          msg.collectionIds
        );
        break;
      }

      // Create a map to easily find collections
      const collectionsMap: { [key: string]: Collection } = {};
      for (const collection of reorderData.collections) {
        collectionsMap[collection.id] = collection;
      }

      // Reorder collections based on the new order
      const reorderedCollections: Collection[] = [];

      // First add collections in the new order
      for (const id of msg.collectionIds) {
        if (collectionsMap[id]) {
          reorderedCollections.push(collectionsMap[id]);
          delete collectionsMap[id]; // Remove from map to track what's been added
        }
      }

      // Add any remaining collections that weren't in the new order
      for (const id in collectionsMap) {
        reorderedCollections.push(collectionsMap[id]);
      }

      console.log(
        "New collections order:",
        reorderedCollections.map((c) => c.id)
      );

      // Update the collections order in the data
      reorderData.collections = reorderedCollections;

      // Save the reordered collections
      await savePluginData(reorderData);

      // Notify UI about the update
      figma.ui.postMessage({
        type: "update",
        data: reorderData,
      });

      console.log("Collections reordered successfully");
      break;

    case "save-imported-collection":
      // Save a newly imported collection to client storage
      const importedCollectionData: PluginData =
        await figma.clientStorage.getAsync("framePresetsData");

      // Check if the collection with this ID already exists
      const existingCollectionIndex =
        importedCollectionData.collections.findIndex(
          (c) => c.id === msg.collection.id
        );

      if (existingCollectionIndex >= 0) {
        // Collection ID already exists, update it
        importedCollectionData.collections[existingCollectionIndex] =
          msg.collection;
      } else {
        // Add the new collection
        importedCollectionData.collections.push(msg.collection);
      }

      // Save the updated data to client storage
      await savePluginData(importedCollectionData);

      console.log(
        `Collection "${msg.collection.name}" imported and saved locally`
      );

      // No need to send update back to UI since it already has the updated data
      break;

    case "close":
      figma.closePlugin();
      break;

    case "ui-ready":
      // UI is ready, initialize it with data
      initializePlugin();
      break;

    case "save-supabase-config":
      // Save Supabase configuration to Figma's clientStorage
      figma.clientStorage.setAsync("supabaseConfig", {
        url: msg.url,
        key: msg.key,
      });
      break;

    case "get-supabase-config":
      // Retrieve Supabase configuration from Figma's clientStorage
      figma.clientStorage
        .getAsync("supabaseConfig")
        .then((config) => {
          if (config) {
            figma.ui.postMessage({
              type: "supabase-config",
              config: config,
            });
          }
        })
        .catch((err) =>
          console.error("Error retrieving Supabase config:", err)
        );
      break;
      
    case "open-url":
      // Open a URL in the default browser
      if (msg.url) {
        figma.openExternal(msg.url);
      }
      break;
  }
};

// Initialize the plugin when it starts
initializePlugin();

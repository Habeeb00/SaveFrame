/// <reference types="@figma/plugin-typings" />
import { createClient } from "@supabase/supabase-js";

// Types
interface FramePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  isFavorite: boolean;
  dateCreated: number;
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
const BUILT_IN_COLLECTION_IDS = ["instagram", "facebook", "twitter", "youtube", "figma"];

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

// Initialize Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

async function syncWithSupabase(data: PluginData): Promise<boolean> {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_ANON_KEY || ""
    );
  }

  try {
    // First delete all existing collections for this user to ensure clean slate
    // This makes sync a true force-replace operation
    const { error: deleteError } = await supabaseClient
      .from("collections")
      .delete()
      .not('id', 'in', BUILT_IN_COLLECTION_IDS); // Preserve built-in collections
      
    if (deleteError) {
      console.error("Error deleting old collections:", deleteError);
      throw deleteError;
    }
    
    // Now insert all current collections
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
    
    figma.notify("Successfully synced all collections to Supabase");
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    figma.notify("Failed to sync collections to Supabase. See console for details.", {error: true});
    return false;
  }
}

// Initialize plugin
figma.showUI(__html__, { width: 320, height: 480 });

// Main function to initialize the plugin
async function initializePlugin() {
  try {
    // Try to load existing data from client storage
    let pluginData: PluginData = await figma.clientStorage
      .getAsync("framePresetsData")
      .then((data) => {
        // Check if the retrieved data is valid
        if (data && data.collections) {
          return data as PluginData;
        } else {
          throw new Error("Invalid or missing plugin data");
        }
      })
      .catch(() => {
        // If no data exists, create default data
        const initialData: PluginData = {
          collections: defaultCollections,
          activeCollectionId: "instagram",
        };
        
        // Save the default data to client storage
        savePluginData(initialData);
        return initialData;
      });

    console.log("Plugin data initialized:", pluginData);
    
    // Send initial data to the UI
    figma.ui.postMessage({
      type: "init",
      data: pluginData,
    });
  } catch (error) {
    console.error("Error initializing plugin data:", error);
  }
}

// Create a new frame with preset dimensions
function createFrame(width: number, height: number, name: string) {
  const frame = figma.createFrame();
  frame.resize(width, height);
  frame.name = name;

  // Center the frame in the viewport
  const viewportCenter = figma.viewport.center;
  frame.x = viewportCenter.x - width / 2;
  frame.y = viewportCenter.y - height / 2;

  // Select the newly created frame
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
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
      const selection = figma.currentPage.selection;
      const frames = selection.filter(
        (node): node is FrameNode => node.type === "FRAME"
      );

      if (frames.length === 0) {
        figma.notify("Please select at least one frame to create a preset");
        return;
      }

      // Send frame data to UI for the creation flow
      figma.ui.postMessage({
        type: "selection-data",
        frames: frames.map((frame) => ({
          name: frame.name,
          width: frame.width,
          height: frame.height,
        })),
      });
      break;

    case "save-preset":
      // Save a new preset to the active collection
      const data: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const collectionIndex = data.collections.findIndex(
        (c) => c.id === msg.collectionId
      );
      if (collectionIndex >= 0) {
        data.collections[collectionIndex].presets.push(msg.preset);
        await savePluginData(data);

        figma.notify(
          `Preset "${msg.preset.name}" saved to collection "${data.collections[collectionIndex].name}"`
        );

        // Send updated data back to the UI
        figma.ui.postMessage({
          type: "update",
          data: data,
        });
      }
      break;

    case "use-preset":
      // Check if we should apply to selection or create a new frame
      if (msg.applyToSelection) {
        // Apply preset to selected frames
        const selection = figma.currentPage.selection;
        const frames = selection.filter(
          (node): node is FrameNode => node.type === "FRAME"
        );
        
        if (frames.length === 0) {
          figma.notify("Please select at least one frame to apply the preset");
          return;
        }
        
        // Apply the preset dimensions to all selected frames
        frames.forEach(frame => {
          frame.resize(msg.preset.width, msg.preset.height);
          // Optionally update the name if appropriate
          // frame.name = msg.preset.name;
        });
        
        figma.notify(`Applied "${msg.preset.name}" to ${frames.length} selected frame${frames.length > 1 ? 's' : ''}`);
      } else {
        // Create a new frame using the selected preset
        createFrame(msg.preset.width, msg.preset.height, msg.preset.name);
      }
      break;

    case "toggle-favorite":
      // Toggle favorite status for a preset
      const favData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const collIdx = favData.collections.findIndex(
        (c) => c.id === msg.collectionId
      );
      if (collIdx >= 0) {
        const presetIdx = favData.collections[collIdx].presets.findIndex(
          (p) => p.id === msg.presetId
        );
        if (presetIdx >= 0) {
          favData.collections[collIdx].presets[presetIdx].isFavorite =
            !favData.collections[collIdx].presets[presetIdx].isFavorite;

          await savePluginData(favData);

          // Send updated data back to the UI
          figma.ui.postMessage({
            type: "update",
            data: favData,
          });
        }
      }
      break;

    case "set-active-collection":
      // Change the active collection
      const activeData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );
      activeData.activeCollectionId = msg.collectionId;
      await savePluginData(activeData);

      // If preserveUIState flag is true, send a minimal update that won't trigger a full re-render
      if (msg.preserveUIState) {
        figma.ui.postMessage({
          type: "active-collection-changed",
          collectionId: msg.collectionId
        });
      } else {
        figma.ui.postMessage({
          type: "update",
          data: activeData,
        });
      }
      break;

    case "create-collection":
      // Create a new collection
      const collectionsData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const newCollection: Collection = {
        id: Date.now().toString(),
        name: msg.name,
        presets: [],
      };

      collectionsData.collections.push(newCollection);
      await savePluginData(collectionsData);

      figma.ui.postMessage({
        type: "update",
        data: collectionsData,
      });

      figma.notify(`Collection "${msg.name}" created`);
      break;

    case "delete-collection":
      // Delete a collection
      const deleteData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const filteredCollections = deleteData.collections.filter(
        (c) => c.id !== msg.collectionId
      );
      deleteData.collections = filteredCollections;

      // If we're deleting the active collection, set a new active collection
      if (
        deleteData.activeCollectionId === msg.collectionId &&
        filteredCollections.length > 0
      ) {
        deleteData.activeCollectionId = filteredCollections[0].id;
      }

      await savePluginData(deleteData);

      figma.ui.postMessage({
        type: "update",
        data: deleteData,
      });
      break;

    case "delete-preset":
      // Delete a preset from a collection
      const presetData: PluginData = await figma.clientStorage.getAsync(
        "framePresetsData"
      );

      const collectionI = presetData.collections.findIndex(
        (c) => c.id === msg.collectionId
      );
      if (collectionI >= 0) {
        presetData.collections[collectionI].presets = presetData.collections[
          collectionI
        ].presets.filter((p) => p.id !== msg.presetId);

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
        figma.notify("Syncing to Supabase completed");
      } else {
        figma.notify("Syncing to Supabase failed");
      }
      break;

    case "import-from-supabase":
      // Handle importing from Supabase (will be implemented in the UI)
      figma.notify("Importing from Supabase...");
      break;

    case "resize-ui":
      // Resize the UI window
      figma.ui.resize(msg.width, msg.height);
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
        key: msg.key
      });
      break;
      
    case "get-supabase-config":
      // Retrieve Supabase configuration from Figma's clientStorage
      figma.clientStorage.getAsync("supabaseConfig")
        .then(config => {
          if (config) {
            figma.ui.postMessage({
              type: "supabase-config",
              config: config
            });
          }
        })
        .catch(err => console.error("Error retrieving Supabase config:", err));
      break;
  }
};

// Initialize the plugin when it starts
initializePlugin();

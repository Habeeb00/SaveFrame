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
      .not("id", "in", BUILT_IN_COLLECTION_IDS); // Preserve built-in collections

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
    figma.notify(
      "Failed to sync collections to Supabase. See console for details.",
      { error: true }
    );
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

      // Send frame data to UI for the creation flow
      figma.ui.postMessage({
        type: "selection-data",
        frames: selectedFrames.map((frame) => ({
          name: frame.name,
          width: frame.width,
          height: frame.height,
          // Capture additional frame properties
          fills: frame.fills,
          strokes: frame.strokes,
          strokeWeight: frame.strokeWeight,
          cornerRadius: frame.cornerRadius,
          effects: frame.effects,
          layoutMode: frame.layoutMode,
          primaryAxisSizingMode: frame.primaryAxisSizingMode,
          counterAxisSizingMode: frame.counterAxisSizingMode,
          primaryAxisAlignItems: frame.primaryAxisAlignItems,
          counterAxisAlignItems: frame.counterAxisAlignItems,
          paddingLeft: frame.paddingLeft,
          paddingRight: frame.paddingRight,
          paddingTop: frame.paddingTop,
          paddingBottom: frame.paddingBottom,
          itemSpacing: frame.itemSpacing,
          clipsContent: frame.clipsContent,
        })),
        targetCollectionId: msg.targetCollectionId || null,
      });
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

    case "use-preset":
      // Check if we should apply to selection or create a new frame
      if (msg.applyToSelection) {
        // Apply preset to selected frames
        const selection = figma.currentPage.selection;
        const framesToApplyTo = selection.filter(
          (node): node is FrameNode => node.type === "FRAME"
        );

        if (framesToApplyTo.length === 0) {
          figma.notify("Please select at least one frame to apply the preset");
          return;
        }

        // Apply the preset dimensions and properties to all selected frames
        framesToApplyTo.forEach((frame) => {
          // Resize the frame
          frame.resize(msg.preset.width, msg.preset.height);

          // Apply all additional frame properties if they exist in the preset
          if (msg.preset.fills) frame.fills = msg.preset.fills as Paint[];
          if (msg.preset.strokes) frame.strokes = msg.preset.strokes as Paint[];
          if (msg.preset.strokeWeight !== undefined)
            frame.strokeWeight = msg.preset.strokeWeight;
          if (msg.preset.cornerRadius !== undefined) {
            if (Array.isArray(msg.preset.cornerRadius)) {
              // Use type assertion to avoid TypeScript errors with cornerRadius array
              (frame as any).cornerRadius = msg.preset.cornerRadius;
            } else {
              frame.cornerRadius = msg.preset.cornerRadius;
            }
          }
          if (msg.preset.effects)
            frame.effects = msg.preset.effects as Effect[];
          if (msg.preset.layoutMode) frame.layoutMode = msg.preset.layoutMode;
          if (msg.preset.primaryAxisSizingMode)
            frame.primaryAxisSizingMode = msg.preset.primaryAxisSizingMode;
          if (msg.preset.counterAxisSizingMode)
            frame.counterAxisSizingMode = msg.preset.counterAxisSizingMode;
          if (msg.preset.primaryAxisAlignItems)
            frame.primaryAxisAlignItems = msg.preset.primaryAxisAlignItems;
          if (msg.preset.counterAxisAlignItems)
            frame.counterAxisAlignItems = msg.preset.counterAxisAlignItems;
          if (msg.preset.paddingLeft !== undefined)
            frame.paddingLeft = msg.preset.paddingLeft;
          if (msg.preset.paddingRight !== undefined)
            frame.paddingRight = msg.preset.paddingRight;
          if (msg.preset.paddingTop !== undefined)
            frame.paddingTop = msg.preset.paddingTop;
          if (msg.preset.paddingBottom !== undefined)
            frame.paddingBottom = msg.preset.paddingBottom;
          if (msg.preset.itemSpacing !== undefined)
            frame.itemSpacing = msg.preset.itemSpacing;
          if (msg.preset.clipsContent !== undefined)
            frame.clipsContent = msg.preset.clipsContent;
        });

        figma.notify(
          `Applied "${msg.preset.name}" to ${
            framesToApplyTo.length
          } selected frame${framesToApplyTo.length > 1 ? "s" : ""}`
        );
      } else {
        // Create a new frame using the selected preset
        createFrame(msg.preset);
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

          await savePluginData(favData);

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

      figma.notify(`Collection "${msg.name}" created`);
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

        figma.notify(`Collection deleted`);
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

      figma.notify("Collections reordered successfully");
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
  }
};

// Initialize the plugin when it starts
initializePlugin();

// @ts-nocheck
/**
 * Instacart MCP (Model Context Protocol) Client
 *
 * This module provides integration with Instacart's MCP server for creating
 * recipe pages and shopping lists through the Model Context Protocol.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface InstacartIngredient {
  name: string;
  display_text: string;
  measurements: Array<{
    quantity: number;
    unit: string;
  }>;
}

interface CreateRecipeArgs {
  title: string;
  ingredients: InstacartIngredient[];
  instructions?: string[];
  imageUrl?: string;
  servings?: number;
}

/**
 * Initialize and connect to Instacart MCP server
 */
async function createMCPClient(apiKey: string, environment: string = "development"): Promise<Client> {
  const mcpUrl = environment === "production"
    ? "https://mcp.instacart.com/mcp"
    : "https://mcp.dev.instacart.tools/mcp";

  console.log(`[INSTACART MCP] Connecting to ${mcpUrl}`);

  const client = new Client({
    name: "healthymama-instacart-client",
    version: "1.0.0",
  }, {
    capabilities: {
      roots: {
        listChanged: false
      }
    }
  });

  // For HTTP-based MCP, we need to use fetch-based communication
  // Since @modelcontextprotocol/sdk doesn't have built-in HTTP transport for client,
  // we'll implement a custom fetch-based approach

  try {
    // MCP over HTTP uses JSON-RPC 2.0
    // We'll make direct HTTP calls to the MCP endpoint

    // Test connection by listing available tools
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP connection failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[INSTACART MCP] Connected. Available tools:`, data.result?.tools?.map((t: any) => t.name));

    return client;
  } catch (error) {
    console.error("[INSTACART MCP] Connection error:", error);
    throw error;
  }
}

/**
 * Call create-recipe tool through MCP
 */
export async function createRecipeViaMCP(
  args: CreateRecipeArgs,
  apiKey: string,
  environment: string = "development"
): Promise<string> {
  const mcpUrl = environment === "production"
    ? "https://mcp.instacart.com/mcp"
    : "https://mcp.dev.instacart.tools/mcp";

  console.log(`[INSTACART MCP] ====== MCP REQUEST START ======`);
  console.log(`[INSTACART MCP] Recipe: "${args.title}"`);
  console.log(`[INSTACART MCP] Environment: ${environment}`);
  console.log(`[INSTACART MCP] MCP URL: ${mcpUrl}`);
  console.log(`[INSTACART MCP] API Key present: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`);
  console.log(`[INSTACART MCP] Ingredients count: ${args.ingredients.length}`);

  try {
    // Prepare the JSON-RPC request
    const requestBody = {
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1000000),
      method: "tools/call",
      params: {
        name: "create-recipe",
        arguments: {
          title: args.title,
          ingredients: args.ingredients.map(ing => ({
            name: ing.name,
            display_text: ing.display_text,
            measurements: ing.measurements,
          })),
          instructions: args.instructions || [`Shop ingredients for ${args.title}`],
          image_url: args.imageUrl || "",
          servings: args.servings,
          landing_page_configuration: {
            partner_linkback_url: "https://healthymama.app",
            enable_pantry_items: true,
          }
        }
      }
    };

    console.log(`[INSTACART MCP] Request body:`, JSON.stringify(requestBody, null, 2));

    // Call the create-recipe tool via JSON-RPC
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[INSTACART MCP] Response status: ${response.status} ${response.statusText}`);
    console.log(`[INSTACART MCP] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[INSTACART MCP] ❌ Tool call failed (${response.status}):`, errorText);
      throw new Error(`MCP tool call failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    console.log(`[INSTACART MCP] ✅ Response received successfully`);
    console.log(`[INSTACART MCP] Full response data:`, JSON.stringify(data, null, 2));

    // MCP response structure
    if (data.error) {
      console.error("[INSTACART MCP] ❌ Error in MCP response:", data.error);
      throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // Extract the Instacart URL from the MCP response
    // The response format from create-recipe tool should include the products_link_url
    const result = data.result;

    // Check if the MCP tool returned an error
    if (result?.isError === true) {
      console.error("[INSTACART MCP] ❌ MCP tool returned an error");
      console.error("[INSTACART MCP] Error details:", JSON.stringify(result, null, 2));

      // Extract error message from content
      const errorText = result.content?.[0]?.text || JSON.stringify(result);
      console.error("[INSTACART MCP] Error text:", errorText);

      throw new Error(`Instacart MCP tool error: ${errorText}`);
    }

    console.log("[INSTACART MCP] Extracting URL from result:", JSON.stringify(result, null, 2));

    // The result might be in result.content or result directly
    let instacartUrl: string | undefined;

    if (typeof result === 'string') {
      // If result is a string, it might be the URL directly
      instacartUrl = result;
    } else if (result?.content) {
      // If result has content array (MCP standard format)
      if (Array.isArray(result.content)) {
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (textContent?.text) {
          // Try to extract URL from text
          const urlMatch = textContent.text.match(/https?:\/\/[^\s]+/);
          instacartUrl = urlMatch ? urlMatch[0] : textContent.text;
        }
      } else if (typeof result.content === 'string') {
        instacartUrl = result.content;
      }
    } else if (result?.products_link_url) {
      // Direct API response format
      instacartUrl = result.products_link_url;
    } else if (result?.recipe_url) {
      instacartUrl = result.recipe_url;
    }

    if (instacartUrl) {
      console.log(`[INSTACART MCP] ✅ Successfully extracted URL: ${instacartUrl}`);
      console.log(`[INSTACART MCP] ====== MCP REQUEST END ======`);
      return instacartUrl;
    }

    console.error("[INSTACART MCP] ❌ No Instacart URL found in MCP response");
    console.error("[INSTACART MCP] Result was:", JSON.stringify(result, null, 2));
    throw new Error("No Instacart URL found in MCP response");
  } catch (error: any) {
    console.error("[INSTACART MCP] ❌ Exception caught:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    console.log(`[INSTACART MCP] ====== MCP REQUEST END (ERROR) ======`);
    throw error;
  }
}

/**
 * Call create-shopping-list tool through MCP
 */
export async function createShoppingListViaMCP(
  ingredients: InstacartIngredient[],
  apiKey: string,
  environment: string = "development"
): Promise<string> {
  const mcpUrl = environment === "production"
    ? "https://mcp.instacart.com/mcp"
    : "https://mcp.dev.instacart.tools/mcp";

  console.log(`[INSTACART MCP SHOPPING LIST] ====== MCP REQUEST START ======`);
  console.log(`[INSTACART MCP SHOPPING LIST] Environment: ${environment}`);
  console.log(`[INSTACART MCP SHOPPING LIST] MCP URL: ${mcpUrl}`);
  console.log(`[INSTACART MCP SHOPPING LIST] API Key present: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`);
  console.log(`[INSTACART MCP SHOPPING LIST] Ingredients count: ${ingredients.length}`);

  try {
    const requestBody = {
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1000000),
      method: "tools/call",
      params: {
        name: "create-shopping-list",
        arguments: {
          title: "Your Grocery List",
          ingredients: ingredients.map(ing => ({
            name: ing.name,
            display_text: ing.display_text,
            measurements: ing.measurements,
          })),
          landing_page_configuration: {
            partner_linkback_url: "https://healthymama.app",
            enable_pantry_items: true,
          }
        }
      }
    };

    console.log(`[INSTACART MCP SHOPPING LIST] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[INSTACART MCP SHOPPING LIST] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[INSTACART MCP SHOPPING LIST] ❌ Tool call failed (${response.status}):`, errorText);
      throw new Error(`MCP tool call failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    console.log(`[INSTACART MCP SHOPPING LIST] ✅ Response received successfully`);
    console.log(`[INSTACART MCP SHOPPING LIST] Full response data:`, JSON.stringify(data, null, 2));

    // Check for JSON-RPC error
    if (data.error) {
      console.error("[INSTACART MCP SHOPPING LIST] ❌ Error in MCP response:", data.error);
      throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const result = data.result;

    // Check if the MCP tool returned an error
    if (result?.isError === true) {
      console.error("[INSTACART MCP SHOPPING LIST] ❌ MCP tool returned an error");
      console.error("[INSTACART MCP SHOPPING LIST] Error details:", JSON.stringify(result, null, 2));

      // Extract error message from content
      const errorText = result.content?.[0]?.text || JSON.stringify(result);
      console.error("[INSTACART MCP SHOPPING LIST] Error text:", errorText);

      throw new Error(`Instacart MCP tool error: ${errorText}`);
    }

    console.log("[INSTACART MCP SHOPPING LIST] Extracting URL from result:", JSON.stringify(result, null, 2));

    // Extract URL from response (same logic as create-recipe)
    let instacartUrl: string | undefined;

    if (typeof result === 'string') {
      instacartUrl = result;
    } else if (result?.content) {
      if (Array.isArray(result.content)) {
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (textContent?.text) {
          const urlMatch = textContent.text.match(/https?:\/\/[^\s]+/);
          instacartUrl = urlMatch ? urlMatch[0] : textContent.text;
        }
      } else if (typeof result.content === 'string') {
        instacartUrl = result.content;
      }
    } else if (result?.products_link_url) {
      instacartUrl = result.products_link_url;
    }

    if (instacartUrl) {
      console.log(`[INSTACART MCP SHOPPING LIST] ✅ Successfully extracted URL: ${instacartUrl}`);
      console.log(`[INSTACART MCP SHOPPING LIST] ====== MCP REQUEST END ======`);
      return instacartUrl;
    }

    console.error("[INSTACART MCP SHOPPING LIST] ❌ No Instacart URL found in MCP response");
    console.error("[INSTACART MCP SHOPPING LIST] Result was:", JSON.stringify(result, null, 2));
    throw new Error("No Instacart URL found in MCP response");
  } catch (error: any) {
    console.error("[INSTACART MCP SHOPPING LIST] ❌ Exception caught:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    console.log(`[INSTACART MCP SHOPPING LIST] ====== MCP REQUEST END (ERROR) ======`);
    throw error;
  }
}

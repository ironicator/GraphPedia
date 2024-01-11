import Sigma from "sigma";
import Graph from "graphology";
import circular from "graphology-layout/circular";
import forceAtlas2 from "graphology-layout-forceatlas2";

import FA2Layout from "graphology-layout-forceatlas2/worker";

import axios from "axios"
import {Coordinates, EdgeDisplayData, NodeDisplayData, PlainObject} from "sigma/types";
import { animateNodes } from "sigma/utils/animate";

const searchData = {
    text: "('Argentia','Messi')",
    depth: 1
}
axios.post('http://localhost:3000/api/postgres/insertIntoBfs', searchData)
    .then(response => {
        console.log('Success:', response.data);
    })
    .catch(error => {
        console.error('Error:', error);
    });


// Function to build the graph from JSON data
function buildGraphFromJson(data) {

    const graph = new Graph();
    // Create a map for page titles
    const pageTitles = new Map();


    function addEdgeIfNeeded(sourceId, targetId) {
        if (!graph.hasEdge(sourceId, targetId)) {
            graph.addEdge(sourceId, targetId);
        }
    }

    // Calculate degrees for each node first
    const degreeMap = new Map();
    data.forEach(item => {
        // Increment the degree for the parent node
        if (!degreeMap.has(item.from_id)) {
            degreeMap.set(item.from_id, 0);
        }
        degreeMap.set(item.from_id, degreeMap.get(item.from_id) + item.to_id.length);

        // Set the degree for child nodes to 1 (or increment if they are also a parent)
        item.to_id.forEach(childId => {
            if (!degreeMap.has(childId)) {
                degreeMap.set(childId, 0);
            }
            // Increment if it's already there, otherwise, it stays 1
            degreeMap.set(childId, degreeMap.get(childId) + 1);
        });
    });

    // Set sizes based on degree
    const minSize = 8, maxSize = 50;
    // @ts-ignore
    const minDegree = Math.min(...degreeMap.values());
    // @ts-ignore
    const maxDegree = Math.max(...degreeMap.values());

    function calculateNodeSize(degree) {
        if (minDegree === maxDegree)
            return maxSize;
        return minSize + ((degree - minDegree) / (maxDegree - minDegree)) * (maxSize - minSize);
    }

    // Add nodes with sizes
    data.forEach(item => {
        const fromId = item.from_id;
        const fromTitle = item.from_title;

        const fromDegree = degreeMap.get(fromId);
        const fromSize = calculateNodeSize(fromDegree);

        addNodeIfNeeded(fromId, fromTitle, fromSize);

        item.to_id.forEach((childId, index) => {
            const childTitle = item.to_title[index];
            const childDegree = degreeMap.get(childId);
            const childSize = calculateNodeSize(childDegree);

            addNodeIfNeeded(childId, childTitle, childSize);
            addEdgeIfNeeded(fromId, childId);
        });
    });


    function addNodeIfNeeded(id, label, size) {
        if (!graph.hasNode(id)) {
            graph.addNode(id, {
                label: label,
                size: size,
                color: "#4444aa"
            });
        }
    }

    // Position nodes on a circle, then run Force Atlas 2 for a while to get
    circular.assign(graph);
    const settings = forceAtlas2.inferSettings(graph);

    forceAtlas2.assign(graph, { settings, iterations: 150 }); // Increase iterations




    // Hide the loader from the DOM:
    const loader = document.getElementById("loader") as HTMLElement;
    loader.style.display = "none";

    // Finally, draw the graph using sigma:
    const container = document.getElementById("sigma-container") as HTMLElement;


    //buttons
    const FA2Button = document.getElementById("forceatlas2") as HTMLElement;
    const FA2StopLabel = document.getElementById("forceatlas2-stop-label") as HTMLElement;
    const FA2StartLabel = document.getElementById("forceatlas2-start-label") as HTMLElement;

    const randomButton = document.getElementById("random") as HTMLElement;

    const circularButton = document.getElementById("circular") as HTMLElement;

    /** FA2 LAYOUT **/

    // Graphology provides a easy to use implementation of Force Atlas 2 in a web worker
    const sensibleSettings = forceAtlas2.inferSettings(graph);
    const fa2Layout = new FA2Layout(graph, {
        settings: sensibleSettings,
    });


    // A variable is used to toggle state between start and stop
    let cancelCurrentAnimation: (() => void) | null = null;

    // correlate start/stop actions with state management
    function stopFA2() {
        fa2Layout.stop();
        FA2StartLabel.style.display = "flex";
        FA2StopLabel.style.display = "none";
    }
    function startFA2() {
        if (cancelCurrentAnimation) cancelCurrentAnimation();
        fa2Layout.start();
        FA2StartLabel.style.display = "none";
        FA2StopLabel.style.display = "flex";
    }

    // the main toggle function
    function toggleFA2Layout() {
        if (fa2Layout.isRunning()) {
            stopFA2();
        } else {
            startFA2();
        }
    }
    // bind method to the forceatlas2 button
    FA2Button.addEventListener("click", toggleFA2Layout);

    /** RANDOM LAYOUT **/
    /* Layout can be handled manually by setting nodes x and y attributes */
    /* This random layout has been coded to show how to manipulate positions directly in the graph instance */
    function randomLayout() {
        // stop fa2 if running
        if (fa2Layout.isRunning()) stopFA2();
        if (cancelCurrentAnimation) cancelCurrentAnimation();

        // to keep positions scale uniform between layouts, we first calculate positions extents
        const xExtents = { min: 0, max: 0 };
        const yExtents = { min: 0, max: 0 };
        graph.forEachNode((node, attributes) => {
            xExtents.min = Math.min(attributes.x, xExtents.min);
            xExtents.max = Math.max(attributes.x, xExtents.max);
            yExtents.min = Math.min(attributes.y, yExtents.min);
            yExtents.max = Math.max(attributes.y, yExtents.max);
        });
        const randomPositions: PlainObject<PlainObject<number>> = {};
        graph.forEachNode((node) => {
            // create random positions respecting position extents
            randomPositions[node] = {
                x: Math.random() * (xExtents.max - xExtents.min),
                y: Math.random() * (yExtents.max - yExtents.min),
            };
        });
        // use sigma animation to update new positions
        cancelCurrentAnimation = animateNodes(graph, randomPositions, { duration: 2000 });
    }

// bind method to the random button
    randomButton.addEventListener("click", randomLayout);

    /** CIRCULAR LAYOUT **/
    function circularLayout() {
        // stop fa2 if running
        if (fa2Layout.isRunning()) stopFA2();
        if (cancelCurrentAnimation) cancelCurrentAnimation();

        //since we want to use animations we need to process positions before applying them through animateNodes
        const circularPositions = circular(graph, { scale: 100 });

        cancelCurrentAnimation = animateNodes(graph, circularPositions, { duration: 2000, easing: "linear" });
    }
    // bind method to the random button
    circularButton.addEventListener("click", circularLayout);

    const renderer = new Sigma(graph, container);

    const searchInput = document.getElementById("search-input") as HTMLInputElement;

    interface State {
        hoveredNode?: string;
        searchQuery: string;

        // State derived from query:
        selectedNode?: string;
        suggestions?: Set<string>;

        // State derived from hovered node:
        hoveredNeighbors?: Set<string>;
    }
    const state: State = { searchQuery: "" };




    // Actions:
    function setSearchQuery(query: string) {
        state.searchQuery = query;

        if (searchInput.value !== query) searchInput.value = query;

        if (query) {
            const lcQuery = query.toLowerCase();
            const suggestions = graph
                .nodes()
                .map((n) => ({ id: n, label: graph.getNodeAttribute(n, "label") as string }))
                .filter(({ label }) => label.toLowerCase().includes(lcQuery));

            // If we have a single perfect match, them we remove the suggestions, and
            // we consider the user has selected a node through the datalist
            // autocomplete:
            if (suggestions.length === 1 && suggestions[0].label === query) {
                state.selectedNode = suggestions[0].id;
                state.suggestions = undefined;

                // Move the camera to center it on the selected node:
                const nodePosition = renderer.getNodeDisplayData(state.selectedNode) as Coordinates;
                renderer.getCamera().animate(nodePosition, {
                    duration: 500,
                });
            }
            // Else, we display the suggestions list:
            else {
                state.selectedNode = undefined;
                state.suggestions = new Set(suggestions.map(({ id }) => id));
            }
        }
        // If the query is empty, then we reset the selectedNode / suggestions state:
        else {
            state.selectedNode = undefined;
            state.suggestions = undefined;
        }

        // Refresh rendering:
        renderer.refresh();
    }


    function setHoveredNode(node?: string) {
        if (node) {
            state.hoveredNode = node;
            state.hoveredNeighbors = new Set(graph.neighbors(node));
        } else {
            state.hoveredNode = undefined;
            state.hoveredNeighbors = undefined;
        }

        // Refresh rendering:
        renderer.refresh();
    }

    // Bind search input interactions:
    searchInput.addEventListener("input", () => {
        setSearchQuery(searchInput.value || "");
    });
    searchInput.addEventListener("blur", () => {
        setSearchQuery("");
    });

    // Bind graph interactions:
    renderer.on("enterNode", ({ node }) => {
        setHoveredNode(node);
    });
    renderer.on("leaveNode", () => {
        setHoveredNode(undefined);
    });

    // Render nodes accordingly to the internal state:
    // 1. If a node is selected, it is highlighted
    // 2. If there is query, all non-matching nodes are greyed
    // 3. If there is a hovered node, all non-neighbor nodes are greyed
    renderer.setSetting("nodeReducer", (node, data) => {
        const res: Partial<NodeDisplayData> = { ...data };

        if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
            res.label = "";
            res.color = "#f6f6f6";
        }

        if (state.selectedNode === node) {
            res.highlighted = true;
        } else if (state.suggestions && !state.suggestions.has(node)) {
            res.label = "";
            res.color = "#f6f6f6";
        }

        return res;
    });

    // Render edges accordingly to the internal state:
    // 1. If a node is hovered, the edge is hidden if it is not connected to the
    //    node
    // 2. If there is a query, the edge is only visible if it connects two
    //    suggestions
    renderer.setSetting("edgeReducer", (edge, data) => {
        const res: Partial<EdgeDisplayData> = { ...data };

        if (state.hoveredNode && !graph.hasExtremity(edge, state.hoveredNode)) {
            res.hidden = true;
        }

        if (state.suggestions && (!state.suggestions.has(graph.source(edge)) || !state.suggestions.has(graph.target(edge)))) {
            res.hidden = true;
        }

        return res;
    });
}

// Function to load JSON and build the graph
function loadJsonAndBuildGraph() {
    fetch('./exampleOutput.json')
        .then(response => response.json())
        .then(data => {
            buildGraphFromJson(data);
        })
        .catch(error => {
            console.error('Error fetching or parsing JSON:', error);
        });
}



// Call the function to start the process
loadJsonAndBuildGraph();


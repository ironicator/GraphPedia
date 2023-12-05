import Sigma from "sigma";
import Graph from "graphology";
import circular from "graphology-layout/circular";
import forceAtlas2 from "graphology-layout-forceatlas2";

// Function to build the graph from JSON data
function buildGraphFromJson(data) {
    const graph = new Graph();
    // Create a map for page titles
    const pageTitles = new Map();
    data.pages.forEach(page => {
        pageTitles.set(page.page_id, page.page_title);
    });

    // Helper function to add a node if it doesn't exist
    function addNodeIfNeeded(id, type, label) {
        if (!graph.hasNode(id)) {
            graph.addNode(id, {
                nodeType: type,
                label: label,
            });
        }
    }


    function addEdgeIfNeeded(sourceId, targetId) {
        if (!graph.hasEdge(sourceId, targetId)) {
            graph.addEdge(sourceId, targetId, { weight: 1 });
        }
    }

    // Process JSON data
    data.pages.forEach(page => {
        const pageId = page.page_id;

        // Add parent node
        addNodeIfNeeded(pageId, "parentNode", page.page_title);

        // Create nodes and edges for child pages
        page.child_ids.forEach(childId => {
            // Find the title of the child page from the map
            const childTitle = pageTitles.get(childId);

            // Add child node
            addNodeIfNeeded(childId, "childNode", childTitle);

            // Add edge between parent and child
            addEdgeIfNeeded(pageId, childId);
        });
    });


    // Add colors to the nodes, based on node types:
    const COLORS: Record<string, string> = { parentNode: "#FA5A3D", childNode: "#5A75DB" };
    graph.forEachNode((node, attributes) =>
        graph.setNodeAttribute(node, "color", COLORS[attributes.nodeType as string]),
    );


    // Use degrees for node sizes:
    const degrees = graph.nodes().map((node) => graph.degree(node));
    const minDegree = Math.min(...degrees);
    const maxDegree = Math.max(...degrees);
    const minSize = 1,
        maxSize = 10;
    graph.forEachNode((node) => {
        const degree = graph.degree(node);
        graph.setNodeAttribute(
            node,
            "size",
            minSize + ((degree - minDegree) / (maxDegree - minDegree)) * (maxSize - minSize),
        );
    });

    // Position nodes on a circle, then run Force Atlas 2 for a while to get
    //    proper graph layout:
    circular.assign(graph);
    const settings = forceAtlas2.inferSettings(graph);

    forceAtlas2.assign(graph, { settings, iterations: 1000 }); // Increase iterations




    // Hide the loader from the DOM:
    const loader = document.getElementById("loader") as HTMLElement;
    loader.style.display = "none";

    // Finally, draw the graph using sigma:
    const container = document.getElementById("sigma-container") as HTMLElement;
    new Sigma(graph, container);
}

// Function to load JSON and build the graph
function loadJsonAndBuildGraph() {
    fetch('./exampleOutput.json')  // Replace with the path to your JSON file
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


import Sigma from "sigma";
import Graph from "graphology";
import circular from "graphology-layout/circular";
import forceAtlas2 from "graphology-layout-forceatlas2";



import FA2Layout from "graphology-layout-forceatlas2/worker";

import axios from "axios"
import { EdgeDisplayData, NodeDisplayData, PlainObject} from "sigma/types";
import {animateNodes} from "sigma/utils/animate";

// Function to build the graph from JSON data
let renderer;


let graph = new Graph();

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
function setSearchQuery(query) {
    // Ensure query is a string
    if (typeof query !== 'string') {
        console.error('setSearchQuery: query is not a string', query);
        return;
    }

    state.searchQuery = query;

    if (searchInput.value !== query) {
        searchInput.value = query;
    }

    // Handle empty query
    if (!query) {
        state.selectedNode = undefined;
        state.suggestions = undefined;
        renderer.refresh();
        return;
    }

    const lcQuery = query.toLowerCase();
    try {
        const suggestions = graph
            .nodes()
            .map((n) => ({
                id: n,
                label: graph.getNodeAttribute(n, "label")
            }))
            .filter(({ label }) => label && label.toLowerCase().includes(lcQuery));

        if (suggestions.length === 1 && suggestions[0].label === query) {
            state.selectedNode = suggestions[0].id;
            state.suggestions = undefined;

            // Move camera to center on selected node
            const nodePosition = renderer.getNodeDisplayData(state.selectedNode);
            if (nodePosition) {
                renderer.getCamera().animate(nodePosition, { duration: 500 });
            }
        } else {
            state.selectedNode = undefined;
            state.suggestions = new Set(suggestions.map(({ id }) => id));
        }
    } catch (error) {
        console.error('Error in setSearchQuery:', error);
    }

    // Refresh rendering
    renderer.refresh();
}
function showSuggestions() {
    const suggestionsDatalist = document.getElementById('suggestions') as HTMLDataListElement;
    suggestionsDatalist.style.display = 'block';
}
function hideSuggestions() {
    const suggestionsDatalist = document.getElementById('suggestions') as HTMLDataListElement;
    suggestionsDatalist.style.display = 'none';
}
function addWordToContainer(word) {
    const container = document.getElementById('word-container');
    const wordBox = document.createElement('span');
    wordBox.className = 'word-box';
    wordBox.textContent = word;

    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'X';
    deleteBtn.onclick = function() {
        container.removeChild(wordBox);
    };

    wordBox.appendChild(deleteBtn);
    container.appendChild(wordBox);
}

function handleSuggestionClick(suggestion) {
    // @ts-ignore
    document.getElementById('search-text').value = ''
    const words = suggestion.split(',');
    words.forEach(addWordToContainer);
    hideSuggestions()
    document.getElementById('search-text').focus()

}
function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
async function updateSuggestions() {
    showSuggestions()
    const searchInputValue = (document.getElementById('search-text') as HTMLInputElement).value.replace('\'', '\'\'');

    if (searchInputValue.length !== 0){
        console.log("Calling updateSuggestions")
        // Get the current value of the search input

        // Fetch suggestions based on the input value
        const suggestions = await getSuggestions(searchInputValue);

        // Update the datalist with these suggestions
        const suggestionsDatalist = document.getElementById('suggestions') as HTMLDataListElement;
        suggestionsDatalist.innerHTML = ''; // Clear existing options
        suggestions.forEach(suggestion => {
            // Replace underscores with spaces in the suggestion
            const suggestionWithSpaces = suggestion.replace(/_/g, ' ');

            const suggestionElement = document.createElement('div');
            suggestionElement.textContent = suggestionWithSpaces;
            suggestionElement.className = 'suggestion-item'; // Assign the class for styling
            suggestionElement.onclick = () => handleSuggestionClick(suggestion);
            suggestionsDatalist.appendChild(suggestionElement);
        });
    }
}
async function getSuggestions(inputValue: string): Promise<string[]> {
    let sugs = [];
    let suggestionInput = {
        word: inputValue,
    };

    try {
        const response = await axios.post('http://localhost:3000/api/postgres/autoComplete', suggestionInput);
        const data = response.data.data;
        data.forEach(sug => {
            sugs.push(sug.page_title);
        });
    } catch (error) {
        console.error('Error:', error);
    }

    return sugs; // Return the suggestions
}
function buildGraphFromJson(data) {
    const link = document.getElementById('dynamic-style');
    // @ts-ignore
    link.href = data.length > 0 ? "index.css" : "home.css";

    if (renderer) {
        renderer.kill();
    }
    graph.clear()
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

    // Set sizes based on individual reference counts
    const minSize = 8, maxSize = 50;

    // Extract all individual reference counts from the data
    const allReferenceCounts = data.flatMap(item => item.reference_count);

    // Calculate the minimum and maximum reference counts for scaling
    const minReferenceCount = Math.min(...allReferenceCounts);
    const maxReferenceCount = Math.max(...allReferenceCounts);

    function calculateMean(data) {
        const total = data.reduce((acc, val) => acc + val, 0);
        return total / data.length;
    }

    function calculateStandardDeviation(data, mean) {
        const squareDiffs = data.map(value => {
            const diff = value - mean;
            return diff * diff;
        });
        const avgSquareDiff = calculateMean(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }
    if (minReferenceCount!==Infinity && maxReferenceCount!== Infinity && minReferenceCount!==maxReferenceCount){
        const mean = calculateMean(allReferenceCounts);
        const standardDeviation = calculateStandardDeviation(allReferenceCounts, mean);

        // Use mean ± 2 sigmas for slider range
        const minThreshold = Math.max(mean - 2 * standardDeviation, 0);
        const maxThreshold = mean + 2 * standardDeviation;



        // @ts-ignore
        document.getElementById("labels-threshold").min = minThreshold;
        // @ts-ignore
        document.getElementById("labels-threshold").max = maxThreshold;
        // @ts-ignore
        document.getElementById("labels-threshold").step = (maxThreshold - minThreshold) / 100;

    }




    // Function to calculate node size based on individual reference count
    function calculateNodeSize(referenceCount) {
        if (minReferenceCount === maxReferenceCount)

            return maxSize;
        return minSize + ((referenceCount - minReferenceCount) / (maxReferenceCount - minReferenceCount)) * (maxSize - minSize);
    }


    // Add nodes with sizes
    // Add nodes with sizes and colors
    data.forEach(item => {
        const fromId = item.from_id;
        let fromTitle = item.from_title;
        if (typeof fromTitle === 'string') {
            fromTitle = fromTitle.replace(/_/g, ' '); // Replace underscores with spaces
        }

        // Set size for the parent node, if needed
        // You might want to set a default size or calculate it differently
        addNodeIfNeeded(fromId, fromTitle, 30, true, maxReferenceCount); // true for parent


        item.to_id.forEach((childId, index) => {
            const childTitle = item.to_title[index];
            const childReferenceCount = item.reference_count[index];
            const childSize = calculateNodeSize(childReferenceCount);

            addNodeIfNeeded(childId, childTitle, childSize, false, item.reference_count[index]); // false for child
            addEdgeIfNeeded(fromId, childId);
        });
    });


    function addNodeIfNeeded(id, label, size, isParent, referenceCount) {
        if (!graph.hasNode(id)) {
            // Node does not exist yet, add it with the appropriate color
            const color = isParent ? "#4444aa" : "#aa4444";
            const Parent = !!isParent;
            if(typeof label === 'string'){
                label = label.replace(/_/g, ' ');
            }
            graph.addNode(id, {
                label: label,
                size: size,
                color: color,
                referenceCount: referenceCount,
                isParent: Parent
            });
        } else if (isParent) {
            // Node already exists but is now identified as a parent, update its color only
            graph.updateNode(id, node => {
                return { ...node, color: "#4444aa", isParent:true};
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



    const searchInput = document.getElementById("search-input") as HTMLInputElement;




    // Delay the initialization of Sigma
    renderer = new Sigma(graph, container);
    // setTimeout(() => {
    //     renderer = new Sigma(graph, container);
    // }, 1);





    // Example setup for throttled fetchData function
    const throttledFetchData = throttle((node) => {
        fetchDataAndShowTooltip(node);
    }, 200); // Adjust delay as needed

    let hideTooltipTimeout;

    renderer.on("enterNode", ({ node }) => {
        clearTimeout(hideTooltipTimeout); // Cancel pending hide operation
        // @ts-ignore
        throttledFetchData(node);
    });

    renderer.on("leaveNode", () => {
        // Prepare to hide tooltip, but with a delay to allow moving to the tooltip
        prepareHideTooltip();
    });

    function prepareHideTooltip() {
        hideTooltipTimeout = setTimeout(() => {
            const tooltip = document.getElementById('tooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        }, 500); // Adjust delay as needed
    }

    const tooltip = document.getElementById('tooltip');
    tooltip.addEventListener('mouseenter', () => {
        clearTimeout(hideTooltipTimeout); // Keep showing the tooltip when mouse is over it
    });
    tooltip.addEventListener('mouseleave', () => {
        prepareHideTooltip(); // Hide the tooltip after a delay when mouse leaves
    });

    function fetchDataAndShowTooltip(node) {
        const nodeData = graph.getNodeAttributes(node);
        const tooltip = document.getElementById('tooltip');
        const encodedLabel = encodeURIComponent(nodeData.label.replace(/"/g, ''));

        // Fetch Wikipedia preview with error handling
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedLabel}`)
            .then(response => response.json())
            .then(data => {
                // Update and show tooltip
                tooltip.innerHTML = `<p>${data.extract}</p>`
                tooltip.style.display = 'block';
                positionTooltip(node);
            })
            .catch(error => console.error('Error fetching Wikipedia summary:', error));
    }

    function positionTooltip(node) {
        // Position the tooltip based on the node's position
        const nodePosition = renderer.getNodeDisplayData(node);
        const tooltip = document.getElementById('tooltip');
        if (nodePosition && tooltip) {
            const screenPosition = renderer.graphToViewport({ x: nodePosition.x, y: nodePosition.y });
            tooltip.style.left = (screenPosition.x + 2) + 'px'; // offsetX
            tooltip.style.top = (screenPosition.y) + 'px'; // offsetY
        }
    }


    // Example throttle function
    function throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function() {
            const context = this;
            const args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function() {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        }
    }


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

    // Add click event listener to nodes
    renderer.on("clickNode", ({ node }) => {
        const wikiPageId = node; // node is the Wikipedia page ID

        if (wikiPageId) {
            // Construct the Wikipedia URL using the page ID
            const wikiUrl = `https://en.wikipedia.org/?curid=${wikiPageId}`;
            // Open the Wikipedia page in a new tab
            window.open(wikiUrl, '_blank');
        }
    });

    const labelsThresholdRange = document.getElementById("labels-threshold") as HTMLInputElement;

    labelsThresholdRange.addEventListener('input', function(e) {
        // @ts-ignore
        const threshold = parseFloat(e.target.value);

        // Loop through each node to determine visibility based on the threshold
        graph.forEachNode((node, attributes) => {
            if(!attributes.isParent){
                if (attributes.referenceCount < threshold) {
                    // Hide the node if its reference count is below the threshold
                    graph.setNodeAttribute(node, 'hidden', true);
                } else {
                    // Show the node otherwise
                    graph.setNodeAttribute(node, 'hidden', false);
                }
            }


        });
        renderer.refresh();
    })
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
function handleSearch() {
    // Retrieve input values
    // @ts-ignore
    // const searchText = document.getElementById("search-text").value;
    function getSearchText() {
        const wordBoxes = document.querySelectorAll('.word-box');
        if (wordBoxes.length > 0){
            const words = Array.from(wordBoxes).map(box => {
                // Assuming the word is the first child node of the word-box
                return box.childNodes[0].textContent.trim().replace('\'', '\'\'');
            });
            return words.join(',');
        } else {
            // @ts-ignore
            let words = document.getElementById("search-text").value.split(',').map(w=>{
                return w.trim()
            }).join(',')


            return words
        }

    }

    const searchText = getSearchText();

    const searchOptionElement = document.getElementById("search-option");
    // @ts-ignore
    const searchOption = parseInt(searchOptionElement.options[searchOptionElement.selectedIndex].value, 10);
    // @ts-ignore
    let threshold = 0
    // @ts-ignore
    if (document.getElementById("threshold").checked){
        // @ts-ignore
        threshold = parseInt(document.getElementById("labels-threshold").value)
    }

    // Process search terms
    // const searchTerms = searchText.split(',').map(term => `'${term.trim()}'`).join(',');







    // function to call autoComplete



// Attach an event listener to the search input
    const suggestionsDatalist = document.getElementById('suggestions') as HTMLDataListElement;


    const searchInputSugs = document.getElementById('search-text') as HTMLInputElement;
    const debouncedUpdateSuggestions = debounce(() => updateSuggestions(), 100);



    searchInputSugs.addEventListener('input', debouncedUpdateSuggestions);




    // Function to show suggestions


    // Function to hide suggestions
    function hideSuggestions() {
        suggestionsDatalist.style.display = 'none';
    }





    const searchData = {
        text: `('${searchText}')`,
        option: searchOption,
        threshold: threshold
    };

    // Make the Axios POST request
    axios.post('http://localhost:3000/api/postgres/insertIntoBfs', searchData)
        .then(async response => {
            console.log('Success:', response.data.data);
            if (response.data.data.length > 0) {
                // fake search
                buildGraphFromJson(response.data.data);
            } else {
                // fake search

                var modal = document.getElementById("myModal");
                modal.style.display = "block";

                var span = document.getElementsByClassName("close")[0];

                // @ts-ignore
                span.onclick = function () {
                    modal.style.display = "none";
                }

                window.onclick = function (event) {
                    if (event.target === modal) {
                        modal.style.display = "none";
                    }
                }
            }

        })
        .catch(error => {
            console.error('Error:', error);
        });


}



// Bind the search button event listener
document.addEventListener("DOMContentLoaded", () => {

    const searchButton = document.getElementById("search-button");
    if (searchButton) {
        searchButton.addEventListener("click", handleSearch);
    }

    const searchInputSugs = document.getElementById('search-text') as HTMLInputElement;
    const debouncedUpdateSuggestions = debounce(() => updateSuggestions(), 100);

    const searchInput = document.getElementById("search-input") as HTMLInputElement;

    searchInput.addEventListener("input", () => {
        setSearchQuery(searchInput.value || "");
    });



    searchInputSugs.addEventListener('input', debouncedUpdateSuggestions);
    searchInputSugs.addEventListener('focus', () => {
        // Check if the input is not empty before showing suggestions
        if (searchInputSugs.value.trim().length !== 0) {
            showSuggestions();
        }
    });

    // Add event listener for Enter key press
    const searchText = document.getElementById("search-text");
    if (searchText) {
        searchText.addEventListener("keyup", (event) => {
            if (event.key === "Enter") {
                event.preventDefault(); // Prevent the default form submission
                handleSearch();
            }
        });
    }
});




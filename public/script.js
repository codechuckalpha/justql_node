// Handle icon clicks
document.querySelectorAll('.icon-item').forEach(icon => {
    icon.addEventListener('click', function() {
        const panel = this.dataset.panel;
        const contentPanel = document.getElementById('contentPanel');
        const sidebarContainer = document.querySelector('.sidebar-container');
        const isCurrentlyActive = this.classList.contains('active');
        const isExpanded = contentPanel.classList.contains('expanded');
        
        // If clicking the same active icon and panel is expanded, collapse it
        if (isCurrentlyActive && isExpanded) {
            contentPanel.classList.remove('expanded');
            this.classList.remove('active');
            sidebarContainer.classList.add('collapsed');
            return;
        }
        
        // Remove collapsed state and active class from all icons
        sidebarContainer.classList.remove('collapsed');
        document.querySelectorAll('.icon-item').forEach(i => i.classList.remove('active'));
        
        // Add active class to clicked icon
        this.classList.add('active');
        
        // Show/hide panels
        document.querySelectorAll('.panel-section').forEach(p => p.style.display = 'none');
        document.getElementById(panel + '-panel').style.display = 'block';
        
        // Expand content panel
        contentPanel.classList.add('expanded');
    });
});

// Handle section collapse/expand
document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', function() {
        this.classList.toggle('collapsed');
        const items = this.nextElementSibling;
        items.classList.toggle('collapsed');
    });
});

// Handle clicking outside to collapse (optional)
document.addEventListener('click', function(e) {
    const sidebar = document.querySelector('.sidebar-container');
    const contentPanel = document.getElementById('contentPanel');
    
    if (!sidebar.contains(e.target)) {
        // Uncomment below if you want clicking outside to collapse the panel
        // contentPanel.classList.remove('expanded');
        // document.querySelectorAll('.icon-item').forEach(i => i.classList.remove('active'));
    }
});

// run query from textarea
const runButton = document.getElementById('run-button');
const sqlTextarea = document.getElementById('sql-textarea');
const tableWrapper = document.getElementById('table-wrapper');
const tablePlaceholder = document.getElementById('table-placeholder');
const resultsTable = document.getElementById('results-table');
const errorDetailsDiv = document.getElementById('error-details');
const errorMessageParagraph = errorDetailsDiv.querySelector('.error-message');

if (runButton && sqlTextarea) {
    runButton.addEventListener('click', async () => {
        const query = sqlTextarea.value.trim();

        if (!query) {
            errorMessageParagraph.textContent = 'Please enter a SQL query';
            errorMessageParagraph.style.color = '#dc2626'; // Red for errors
            return;
        }

        errorMessageParagraph.textContent = 'Executing query...';
        errorMessageParagraph.style.color = '#3b82f6'; /* Blue for loading */

        try {
            // Assuming a backend endpoint '/run-query' for the actual query execution
            const response = await fetch('/run-query', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sql: query })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.details || 'Unknown server error');
            }

            const data = await response.json();
            console.log(data); // Log the response from the server

            errorMessageParagraph.textContent = ''; // Clear error message
            errorMessageParagraph.style.color = ''; // Reset color

            if (data.results && data.results.length > 0) {
                // Hide placeholder and show table
                if (tablePlaceholder) tablePlaceholder.style.display = 'none';
                resultsTable.style.display = 'table';

                let tableHTML = '<thead><tr>';
                const headers = Object.keys(data.results[0]);
                headers.forEach(header => {
                    tableHTML += `<th>${header}</th>`;
                });
                tableHTML += '</tr></thead><tbody>';

                data.results.forEach(row => {
                    tableHTML += '<tr>';
                    headers.forEach(header => {
                        tableHTML += `<td>${row[header] || ''}</td>`;
                    });
                    tableHTML += '</tr>';
                });
                tableHTML += '</tbody>';
                resultsTable.innerHTML = tableHTML;

                // Store results globally for chart type switching
                window.lastQueryResults = data.results;

                // Generate chart with the same data
                generateChart(data.results);

            } else {
                // Show placeholder if no results
                if (tablePlaceholder) tablePlaceholder.style.display = 'block';
                resultsTable.style.display = 'none';
                tablePlaceholder.querySelector('p:first-child').textContent = 'Query executed successfully but returned no results.';
                tablePlaceholder.querySelector('p:nth-child(2)').textContent = ''; // Clear sub-message

                clearChart();
                window.lastQueryResults = []; // Clear global results if no data
            }
        } catch (error) {
            console.error('Error executing SQL:', error);
            errorMessageParagraph.textContent = `Error: ${error.message || 'Unknown error occurred'}`;
            errorMessageParagraph.style.color = '#dc2626'; // Red for errors

            clearChart();
            window.lastQueryResults = []; // Clear global results on error
            // Show placeholder on error
            if (tablePlaceholder) tablePlaceholder.style.display = 'block';
            resultsTable.style.display = 'none';
            tablePlaceholder.querySelector('p:first-child').textContent = 'Data table will appear here';
            tablePlaceholder.querySelector('p:nth-child(2)').textContent = 'Data table will be generated based on your query results';
        }
    });
}

// To handle tab presses when typing sql queries and Ctrl + Enter to run query 
sqlTextarea.addEventListener('keydown', function(event) {
    if (event.key === 'Tab') {
      event.preventDefault(); // Prevent default tab behavior
  
      const start = this.selectionStart;
      const end = this.selectionEnd;
      const value = this.value;
  
      // Insert a tab character at the current cursor position
      this.value = value.substring(0, start) + '\t' + value.substring(end);
  
      // Move the cursor to after the inserted tab
      this.selectionStart = this.selectionEnd = start + 1;
    } 
    // New: Handle Ctrl + Enter to run query
    else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { // Check for Ctrl or Cmd (for Mac)
        event.preventDefault(); // Prevent new line
        runButton.click(); // Programmatically click the run button
    }
});

// Charting Functions
const chartTypeDropdown = document.getElementById('chart-type-dropdown'); // Get dropdown reference

function generateChart(results) {
    const chartContainer = document.getElementById('chart-container');
    const chartPlaceholder = document.getElementById('chart-placeholder');
    const chartDiv = document.querySelector('.chart-div');
    const selectedChartType = chartTypeDropdown ? chartTypeDropdown.value : 'line'; // Get selected type

    if (!results || results.length === 0) {
        clearChart();
        return;
    }

    const columns = Object.keys(results[0]);

    // Clear any existing chart before drawing a new one
    if (chartContainer.data) {
        Plotly.purge(chartContainer);
    }

    if (selectedChartType === 'timeseries') {
        if (columns.length >= 2) {
            if (chartPlaceholder) chartPlaceholder.style.display = 'none';
            if (chartDiv) {
                chartDiv.style.minHeight = '350px';
            }
            if (columns.length === 3) {
                createTimeSeriesChart(results, columns[0], columns[2], columns[1], chartContainer);
            } else {
                createTimeSeriesChart(results, columns[0], columns[1], null, chartContainer);
            }
        } else {
            clearChart();
            errorMessageParagraph.textContent = 'Time series chart requires at least 2 columns (date, value).';
            errorMessageParagraph.style.color = '#dc2626';
        }
    } else if (columns.length === 3) {
        if (chartPlaceholder) chartPlaceholder.style.display = 'none';
        if (chartDiv) {
            chartDiv.style.minHeight = '350px';
        }
        if (selectedChartType === 'column') {
            createMultiStackedColumnChart(results, columns[0], columns[1], columns[2], chartContainer);
        } else {
            createMultiLineChart(results, columns[0], columns[1], columns[2], chartContainer);
        }
    } else if (columns.length === 2) {
        if (chartPlaceholder) chartPlaceholder.style.display = 'none';
        if (chartDiv) {
            chartDiv.style.minHeight = '350px';
        }
        if (selectedChartType === 'column') {
            createSimpleColumnChart(results, columns[0], columns[1], chartContainer);
        } else {
            createSimpleLineChart(results, columns[0], columns[1], chartContainer);
        }
    } else {
        clearChart();
        errorMessageParagraph.textContent = 'Charts require 2 or 3 columns for current visualization types.';
        errorMessageParagraph.style.color = '#dc2626';
    }
}

function createMultiLineChart(results, xColumn, groupColumn, yColumn, container) {
    const groupedData = {};
    results.forEach(row => {
        const groupValue = row[groupColumn];
        if (!groupedData[groupValue]) {
            groupedData[groupValue] = [];
        }
        groupedData[groupValue].push({
            x: row[xColumn],
            y: parseFloat(row[yColumn]) || 0
        });
    });

    const traces = Object.keys(groupedData).map((groupName, index) => {
        const sortedData = groupedData[groupName].sort((a, b) => {
            if (typeof a.x === 'string' && typeof b.x === 'string') {
                return a.x.localeCompare(b.x);
            }
            return a.x - b.x;
        });

        return {
            x: sortedData.map(d => d.x),
            y: sortedData.map(d => d.y),
            type: 'scatter',
            mode: 'lines+markers',
            name: groupName,
            line: {
                color: getLineColor(index),
                width: 2
            },
            marker: {
                size: 6,
                color: getLineColor(index)
            }
        };
    });

    const layout = {
        title: `${yColumn} by ${xColumn} (grouped by ${groupColumn})`,
        paper_bgcolor: '#2d2d30',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#cccccc' },
        xaxis: {
            title: xColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        yaxis: {
            title: yColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        legend: {
            font: { color: '#cccccc' },
            bgcolor: 'rgba(45, 45, 48, 0.8)',
            bordercolor: '#333',
            borderwidth: 1
        },
        margin: { t: 50, b: 50, l: 50, r: 50 }
    };

    const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
        scrollZoom: false,
        doubleClick: false,
        showTips: false,
        staticPlot: false
    };

    Plotly.newPlot(container, traces, layout, config);
}

function createSimpleLineChart(results, xColumn, yColumn, container) {
    const sortedResults = [...results].sort((a, b) => {
        if (typeof a[xColumn] === 'string' && typeof b[xColumn] === 'string') {
            return a[xColumn].localeCompare(b[xColumn]);
        }
        return (parseFloat(a[xColumn]) || 0) - (parseFloat(b[xColumn]) || 0);
    });

    const trace = {
        x: sortedResults.map(row => row[xColumn]),
        y: sortedResults.map(row => parseFloat(row[yColumn]) || 0),
        type: 'scatter',
        mode: 'lines+markers',
        name: yColumn,
        line: {
            color: '#6366f1',
            width: 2
        },
        marker: {
            size: 6,
            color: '#6366f1'
        }
    };

    const layout = {
        title: `${yColumn} by ${xColumn}`,
        paper_bgcolor: '#2d2d30',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#cccccc' },
        xaxis: {
            title: xColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        yaxis: {
            title: yColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        margin: { t: 50, b: 50, l: 50, r: 50 }
    };

    const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
        scrollZoom: false,
        doubleClick: false,
        showTips: false,
        staticPlot: false
    };

    Plotly.newPlot(container, [trace], layout, config);
}

// NEW: Function to create a multi-stacked column chart
function createMultiStackedColumnChart(results, xColumn, groupColumn, yColumn, container) {
    const groupedData = {};
    results.forEach(row => {
        const groupValue = row[groupColumn];
        if (!groupedData[groupValue]) {
            groupedData[groupValue] = [];
        }
        groupedData[groupValue].push({
            x: row[xColumn],
            y: parseFloat(row[yColumn]) || 0
        });
    });

    const traces = Object.keys(groupedData).map((groupName, index) => {
        const sortedData = groupedData[groupName].sort((a, b) => {
            if (typeof a.x === 'string' && typeof b.x === 'string') {
                return a.x.localeCompare(b.x);
            }
            return a.x - b.x;
        });

        return {
            x: sortedData.map(d => d.x),
            y: sortedData.map(d => d.y),
            type: 'bar',
            name: groupName,
            marker: {
                color: getLineColor(index)
            }
        };
    });

    const layout = {
        title: `${yColumn} by ${xColumn} (grouped by ${groupColumn})`,
        barmode: 'stack', // Key change: 'stack' for stacked column chart
        paper_bgcolor: '#2d2d30',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#cccccc' },
        xaxis: {
            title: xColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        yaxis: {
            title: yColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        legend: {
            font: { color: '#cccccc' },
            bgcolor: 'rgba(45, 45, 48, 0.8)',
            bordercolor: '#333',
            borderwidth: 1
        },
        margin: { t: 50, b: 50, l: 50, r: 50 }
    };

    const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
        scrollZoom: false,
        doubleClick: false,
        showTips: false,
        staticPlot: false
    };

    Plotly.newPlot(container, traces, layout, config);
}

// Function to create a simple column chart (for 2 columns) - no changes needed for stacking here
function createSimpleColumnChart(results, xColumn, yColumn, container) {
    const sortedResults = [...results].sort((a, b) => {
        if (typeof a[xColumn] === 'string' && typeof b[xColumn] === 'string') {
            return a[xColumn].localeCompare(b[xColumn]);
        }
        return (parseFloat(a[xColumn]) || 0) - (parseFloat(b[xColumn]) || 0);
    });

    const trace = {
        x: sortedResults.map(row => row[xColumn]),
        y: sortedResults.map(row => parseFloat(row[yColumn]) || 0),
        type: 'bar',
        name: yColumn,
        marker: {
            color: '#6366f1'
        }
    };

    const layout = {
        title: `${yColumn} by ${xColumn}`,
        paper_bgcolor: '#2d2d30',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#cccccc' },
        xaxis: {
            title: xColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        yaxis: {
            title: yColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        margin: { t: 50, b: 50, l: 50, r: 50 }
    };

    const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
        scrollZoom: false,
        doubleClick: false,
        showTips: false,
        staticPlot: false
    };

    Plotly.newPlot(container, [trace], layout, config);
}

// NEW: Function to create a time series chart
// Handles 2 columns (x-date, y-value) or 3 columns (x-date, y-value, group-series)
function createTimeSeriesChart(results, xColumn, yColumn, groupColumn, container) {
    let traces = [];
    let sortedResults = [];

    // Determine if it's single series or multi series
    if (groupColumn && results.some(row => row[groupColumn] !== results[0][groupColumn])) {
        // Multi-series time series
        const groupedData = {};
        results.forEach(row => {
            const groupValue = row[groupColumn];
            if (!groupedData[groupValue]) {
                groupedData[groupValue] = [];
            }
            groupedData[groupValue].push({
                x: row[xColumn],
                y: parseFloat(row[yColumn]) || 0
            });
        });

        traces = Object.keys(groupedData).map((groupName, index) => {
            const dataForGroup = groupedData[groupName].sort((a, b) => new Date(a.x) - new Date(b.x));
            return {
                x: dataForGroup.map(d => d.x),
                y: dataForGroup.map(d => d.y),
                type: 'scatter',
                mode: 'lines',
                name: groupName,
                line: { color: getLineColor(index), width: 2 }
            };
        });
    } else {
        // Single series time series (or 3 columns but all same group value)
        sortedResults = [...results].sort((a, b) => new Date(a[xColumn]) - new Date(b[xColumn]));
        traces.push({
            x: sortedResults.map(row => row[xColumn]),
            y: sortedResults.map(row => parseFloat(row[yColumn]) || 0),
            type: 'scatter',
            mode: 'lines',
            name: yColumn,
            line: { color: '#6366f1', width: 2 }
        });
    }

    const layout = {
        title: `${yColumn} over Time${groupColumn ? ` (grouped by ${groupColumn})` : ''}`,
        paper_bgcolor: '#2d2d30',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#cccccc' },
        xaxis: {
            title: xColumn,
            type: 'date', // Crucial for time series
            color: '#cccccc',
            gridcolor: '#404040',
            rangeslider: { // Add the range slider
                visible: true, // Set to true to show the slider
                // Optionally style slider fill color
                bgcolor: '#444444', 
                bordercolor: '#555555',
                thickness: 0.15 // Adjust slider height
            },
            rangeselector: { 
                buttons: [
                    { count: 1, label: '1m', step: 'month', stepmode: 'backward' },
                    { count: 6, label: '6m', step: 'month', stepmode: 'backward' },
                    { count: 1, label: '1y', step: 'year', stepmode: 'backward' },
                    { step: 'all' }
                ],
                bgcolor: '#333333',
                activecolor: '#6366f1',
                bordercolor: '#555555',
                font: { color: '#cccccc' }
            }
        },
        yaxis: {
            title: yColumn,
            color: '#cccccc',
            gridcolor: '#404040'
        },
        legend: {
            font: { color: '#cccccc' },
            bgcolor: 'rgba(45, 45, 48, 0.8)',
            bordercolor: '#333',
            borderwidth: 1
        },
        margin: { t: 50, b: 100, l: 50, r: 50 } 
    };

    const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        // Crucial for disabling click-and-drag selection in time series:
        dragmode: false, // Set dragmode to false to disable all drag interactions
        modeBarButtonsToRemove: ['pan2d', 'lasso2d'], 
        scrollZoom: true, // Allow zoom with scroll for time series
        doubleClick: 'reset', // Double click to reset zoom
        showTips: false,
        staticPlot: false
    };

    Plotly.newPlot(container, traces, layout, config);
}


function getLineColor(index) {
    const colors = [
        '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
        '#ef4444', '#ec4899', '#84cc16', '#f97316', '#6b7280'
    ];
    return colors[index % colors.length];
}

function clearChart() {
    const chartContainer = document.getElementById('chart-container');
    const chartPlaceholder = document.getElementById('chart-placeholder');
    const chartDiv = document.querySelector('.chart-div');

    if (chartPlaceholder) chartPlaceholder.style.display = 'block';
    if (chartContainer && chartContainer.data) Plotly.purge(chartContainer); // Ensure purge for a clean slate
    if (chartDiv) chartDiv.style.minHeight = 'auto';
}

// Ensure GridStack and Plotly are aware of each other's resizing
document.addEventListener('DOMContentLoaded', function () {
    const grid = GridStack.init({
        alwaysShowResizeHandle: true,
        float: true,
        disableResize: false,
        // *** NEW: Designate the drag handle for GridStack items ***
        // Only elements with this class will initiate a GridStack drag.
        handle: '.grid-drag-handle',
        // *** NEW: Filter out specific elements from being draggable ***
        // Plotly chart area (its internal <canvas> or <svg> for interaction)
        // This targets the main interactive area of a Plotly chart
        filter: '.js-plotly-plot .plotly, .js-plotly-plot .svg-container, .plotly-event-overlay' 
    });

    // Modified GridStack event listeners to use a blocking overlay
    grid.on('resizestart dragstart', function (event, el) {
        // Find the specific chart container within the dragged/resized element
        const chartContainer = el.querySelector('#chart-container');
        if (chartContainer) {
            // Create and append a transparent overlay to block events
            const overlay = document.createElement('div');
            overlay.className = 'plotly-event-overlay';
            // Position the overlay exactly over the chart
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.zIndex = '10'; // Ensure it's above the chart
            overlay.style.background = 'rgba(0,0,0,0)'; // Transparent
            overlay.style.cursor = 'grab'; // Indicate drag action (optional)
            
            // Append to the grid-stack-item-content to cover only its area
            el.querySelector('.grid-stack-item-content').appendChild(overlay);
        }
    });

    grid.on('resizestop dragstop', function (event, el) {
        // Remove the overlay after drag/resize stops
        const overlay = el.querySelector('.plotly-event-overlay');
        if (overlay) {
            overlay.remove();
        }
        // Trigger Plotly resize after operations
        if (el.id === 'data-analysis-section') {
            setTimeout(() => {
                Plotly.Plots.resize('chart-container');
            }, 100);
        }
    });

    // Remove the complex textarea resize logic since grid-stack handles it
const textarea = document.getElementById('sql-textarea');
const sqlEditorItem = document.getElementById('sql-editor-item'); 

if (textarea && sqlEditorItem) {
    // Only keep the tab and Ctrl+Enter functionality
    textarea.addEventListener('keydown', function(event) {
        if (event.key === 'Tab') {
            event.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const value = this.value;
            this.value = value.substring(0, start) + '\t' + value.substring(end);
            this.selectionStart = this.selectionEnd = start + 1;
        } 
        else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            document.getElementById('run-button').click();
        }
    });
}


    // New: ResizeObserver for the chart container's parent
    const dataAnalysisSection = document.getElementById('data-analysis-section');
    if (dataAnalysisSection) {
        const chartResizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                // Check if the content box size has changed
                if (entry.contentBoxSize) {
                    const chartContainer = document.getElementById('chart-container');
                    // Ensure a chart has actually been plotted before attempting to resize
                    if (chartContainer && chartContainer.data) {
                        // Use requestAnimationFrame for smooth resizing
                        window.requestAnimationFrame(() => {
                            try {
                                Plotly.Plots.resize(chartContainer);
                                console.log('Chart resized via ResizeObserver.');
                            } catch (e) {
                                console.log('Chart resize failed via ResizeObserver:', e);
                            }
                        });
                    }
                }
            }
        });
        // Observe the parent container that changes size
        chartResizeObserver.observe(dataAnalysisSection);
    }


    grid.on('change', function (event, items) {
        items.forEach(item => {
            if (item.el && item.el.id === 'data-analysis-section') {
                const chartContainer = document.getElementById('chart-container');
                if (chartContainer && chartContainer.data) {
                    // This is now redundant as ResizeObserver on dataAnalysisSection handles it.
                    // setTimeout(() => { Plotly.Plots.resize('chart-container'); }, 100);
                }
            }
        });
    });

    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebarContainer = document.getElementById('sidebar-container');

    toggleSidebarBtn.addEventListener('click', () => {
        sidebarContainer.classList.toggle('collapsed');
        // Let the ResizeObserver on data-analysis-section handle the chart resize.
        // The sidebar's class change will affect .main-content's width, which affects data-analysis-section's width.
    });

    // Removed the MutationObserver that was previously here attempting to handle chart resize.
    // This simplifies the logic and relies on ResizeObserver being the single source of truth.

    const iconItems = document.querySelectorAll('.icon-item');
    const panelSections = document.querySelectorAll('.panel-section');

    iconItems.forEach(item => {
        item.addEventListener('click', () => {
            const panelId = item.dataset.panel + '-panel'; 

            iconItems.forEach(i => i.classList.remove('active'));
            panelSections.forEach(p => p.style.display = 'none');

            item.classList.add('active');
            const targetPanel = document.getElementById(panelId);
            if (targetPanel) {
                targetPanel.style.display = 'block';
            }
            if (sidebarContainer.classList.contains('collapsed')) {
                sidebarContainer.classList.remove('collapsed');
            }
        });
    });

    const initialActiveIcon = document.querySelector('.icon-item[data-panel="connections"]');
    if (initialActiveIcon) {
        initialActiveIcon.classList.add('active');
        document.getElementById('connections-panel').style.display = 'block';
    }

    const sectionHeaders = document.querySelectorAll('.section-header');
    sectionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            header.classList.toggle('collapsed');
            const sectionItems = header.nextElementSibling;
            if (sectionItems) {
                sectionItems.style.display = sectionItems.style.display === 'none' ? 'block' : 'none';
            }
        });
    });
});

// IMPORTANT: Event listener to re-draw chart on dropdown change
// Ensure this runs after the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const chartTypeDropdown = document.getElementById('chart-type-dropdown');
    if (chartTypeDropdown) {
        chartTypeDropdown.addEventListener('change', () => {
            // Re-run the generateChart function with the last known data
            // This assumes your data is stored in a globally accessible variable like window.lastQueryResults
            // OR that your 'run' button logic also stores the results here.
            if (window.lastQueryResults) { // Make sure results exist before trying to chart
                generateChart(window.lastQueryResults);
            } else {
                // If no results yet, clear the chart or show a message
                clearChart();
                console.warn("No data available to re-draw chart. Run a query first.");
            }
        });
    }
});

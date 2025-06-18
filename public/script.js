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

                // Generate chart with the same data
                generateChart(data.results);

            } else {
                // Show placeholder if no results
                if (tablePlaceholder) tablePlaceholder.style.display = 'block';
                resultsTable.style.display = 'none';
                tablePlaceholder.querySelector('p:first-child').textContent = 'Query executed successfully but returned no results.';
                tablePlaceholder.querySelector('p:nth-child(2)').textContent = ''; // Clear sub-message

                clearChart();
            }
        } catch (error) {
            console.error('Error executing SQL:', error);
            errorMessageParagraph.textContent = `Error: ${error.message || 'Unknown error occurred'}`;
            errorMessageParagraph.style.color = '#dc2626'; // Red for errors

            clearChart();
            // Show placeholder on error
            if (tablePlaceholder) tablePlaceholder.style.display = 'block';
            resultsTable.style.display = 'none';
            tablePlaceholder.querySelector('p:first-child').textContent = 'Data table will appear here';
            tablePlaceholder.querySelector('p:nth-child(2)').textContent = 'Data table will be generated based on your query results';
        }
    });
}

// To handle tab presses when typing sql queries
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


// Charting Functions (already present in your code)
function generateChart(results) {
    const chartContainer = document.getElementById('chart-container');
    const chartPlaceholder = document.getElementById('chart-placeholder');
    const chartDiv = document.querySelector('.chart-div');

    if (!results || results.length === 0) {
        clearChart();
        return;
    }

    const columns = Object.keys(results[0]);

    if (columns.length === 3) {
        if (chartPlaceholder) chartPlaceholder.style.display = 'none';
        if (chartDiv) {
            chartDiv.style.minHeight = '350px';
        }
        createMultiLineChart(results, columns[0], columns[1], columns[2], chartContainer);
    } else if (columns.length === 2) { // Handle 2 columns for a simple line chart
        if (chartPlaceholder) chartPlaceholder.style.display = 'none';
        if (chartDiv) {
            chartDiv.style.minHeight = '350px';
        }
        createSimpleLineChart(results, columns[0], columns[1], chartContainer);
    } else {
        clearChart();
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
        displayModeBar: false, // Hide the mode bar
        displaylogo: false,   // Hide the Plotly logo
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
        // Fix: Corrected sorting for numerical columns
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
        displayModeBar: false, // Hide the mode bar
        displaylogo: false,   // Hide the Plotly logo
        modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
        scrollZoom: false,
        doubleClick: false,
        showTips: false,
        staticPlot: false
    };

    Plotly.newPlot(container, [trace], layout, config);
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
    if (chartContainer && chartContainer.data) Plotly.purge(chartContainer);
    if (chartDiv) chartDiv.style.minHeight = 'auto';
}

// Ensure GridStack and Plotly are aware of each other's resizing
document.addEventListener('DOMContentLoaded', function () {
    const grid = GridStack.init({
        float: true,
        cellHeight: 80,
        disableResize: false
    });

    grid.on('resizestart', function (event, el) {
        const plotlyDiv = el.querySelector('.plotly-graph-div');
        if (plotlyDiv) {
            plotlyDiv.style.pointerEvents = 'none';
        }
    });

    grid.on('resizestop', function (event, el) {
        const plotlyDiv = el.querySelector('.plotly-graph-div');
        if (plotlyDiv) {
            plotlyDiv.style.pointerEvents = 'auto';
            if (el.id === 'data-analysis-section') {
                setTimeout(() => {
                    Plotly.Plots.resize('chart-container');
                }, 100);
            }
        }
    });

    grid.on('dragstart', function (event, el) {
        const plotlyDiv = el.querySelector('.plotly-graph-div');
        if (plotlyDiv) {
            plotlyDiv.style.pointerEvents = 'none';
        }
    });

    grid.on('dragstop', function (event, el) {
        const plotlyDiv = el.querySelector('.plotly-graph-div');
        if (plotlyDiv) {
            plotlyDiv.style.pointerEvents = 'auto';
        }
    });

    // Add textarea resize functionality (keeping user's original logic)
    const textarea = document.getElementById('sql-textarea');
    const sqlEditorItem = document.getElementById('sql-editor-item'); 

    if (textarea && sqlEditorItem) {
        let originalHeight = textarea.offsetHeight;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const newHeight = entry.contentRect.height;
                const heightDiff = newHeight - originalHeight;
                const gridUnitsToAdd = Math.floor(heightDiff / 80);

                if (gridUnitsToAdd > 0) {
                    const currentGridHeight = parseInt(sqlEditorItem.getAttribute('gs-h')) || 3;
                    const newGridHeight = currentGridHeight + gridUnitsToAdd;
                    grid.update(sqlEditorItem, { h: newGridHeight });
                    originalHeight = newHeight;
                } else if (gridUnitsToAdd < 0 && heightDiff < -40) {
                    const currentGridHeight = parseInt(sqlEditorItem.getAttribute('gs-h')) || 3;
                    const newGridHeight = Math.max(2, currentGridHeight + gridUnitsToAdd);
                    if (newGridHeight !== currentGridHeight) {
                        grid.update(sqlEditorItem, { h: newGridHeight }); 
                        originalHeight = newHeight;
                    }
                }
            }
        });
        resizeObserver.observe(textarea);

        let isResizing = false;
        let startHeight = 0;
        let startGridHeight = 0;

        textarea.addEventListener('mousedown', function (e) {
            const rect = textarea.getBoundingClientRect();
            const isNearBottomRight = (
                e.clientX > rect.right - 20 &&
                e.clientY > rect.bottom - 20
            );

            if (isNearBottomRight) {
                isResizing = true;
                startHeight = textarea.offsetHeight;
                startGridHeight = parseInt(sqlEditorItem.getAttribute('gs-h')) || 3;

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }
        });

        function handleMouseMove(e) {
            if (!isResizing) return;
            const currentHeight = textarea.offsetHeight;
            const heightDiff = currentHeight - startHeight;
            const gridUnitsToAdd = Math.floor(heightDiff / 60);

            if (Math.abs(gridUnitsToAdd) > 0) {
                const newGridHeight = Math.max(2, startGridHeight + gridUnitsToAdd);
                grid.update(sqlEditorItem, { h: newGridHeight });
            }
        }

        function handleMouseUp() {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
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

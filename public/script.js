// Complete corrected script.js with layout functionality

// Global variable to store the grid instance
let gridInstance = null;

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
const saveButton = document.getElementById('save-button');
const newQueryButton = document.getElementById('new-query-button');
const sqlTextarea = document.getElementById('sql-textarea');
const tableWrapper = document.getElementById('table-wrapper');
const tablePlaceholder = document.getElementById('table-placeholder');
const resultsTable = document.getElementById('results-table');
const downloadCsvButton = document.getElementById('download-csv-button');
const downloadChartButton = document.getElementById('download-chart-button');

// Sorting state
let currentSortColumn = null;
let currentSortDirection = null; // 'desc' for high to low, 'asc' for low to high

// Sorting functions
function sortTableData(data, column, direction) {
    return [...data].sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return direction === 'desc' ? 1 : -1;
        if (bVal == null) return direction === 'desc' ? -1 : 1;
        
        // Try to parse as numbers if possible
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return direction === 'desc' ? bNum - aNum : aNum - bNum;
        }
        
        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        
        if (direction === 'desc') {
            return bStr.localeCompare(aStr);
        } else {
            return aStr.localeCompare(bStr);
        }
    });
}

function handleColumnHeaderClick(column) {
    if (currentSortColumn === column) {
        // Toggle direction
        currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
    } else {
        // New column, start with high to low (desc)
        currentSortColumn = column;
        currentSortDirection = 'desc';
    }
    
    // Re-render table with sorted data
    if (window.lastQueryResults && window.lastQueryResults.length > 0) {
        const sortedData = sortTableData(window.lastQueryResults, currentSortColumn, currentSortDirection);
        renderTable(sortedData, Object.keys(window.lastQueryResults[0]));
    }
}

function renderTable(data, headers) {
    let tableHTML = '<thead><tr>';
    headers.forEach(header => {
        const isCurrentSort = currentSortColumn === header;
        const arrow = isCurrentSort ? (currentSortDirection === 'desc' ? ' ▲' : ' ▼') : '';
        tableHTML += `<th onclick="handleColumnHeaderClick('${header}')" style="cursor: pointer; user-select: none;">${header}${arrow}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    data.forEach(row => {
        tableHTML += '<tr>';
        headers.forEach(header => {
            tableHTML += `<td>${row[header] || ''}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody>';
    resultsTable.innerHTML = tableHTML;
}

function downloadCSV() {
    if (!window.lastQueryResults || window.lastQueryResults.length === 0) {
        alert('No data to download');
        return;
    }

    const data = window.lastQueryResults; // Use original unsorted data
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    let csvContent = '';
    
    // Add headers
    csvContent += headers.map(header => `"${header}"`).join(',') + '\n';
    
    // Add data rows
    data.forEach(row => {
        const rowData = headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes
            const escapedValue = value != null ? String(value).replace(/"/g, '""') : '';
            return `"${escapedValue}"`;
        });
        csvContent += rowData.join(',') + '\n';
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'query_results.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function downloadChart() {
    const chartContainer = document.getElementById('chart-container');
    
    // Check if chart exists
    if (!chartContainer || !chartContainer.data || chartContainer.data.length === 0) {
        alert('No chart to download');
        return;
    }

    // Create a temporary container with larger dimensions for full chart export
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1200px';  // Larger width for full legend
    tempContainer.style.height = '800px';  // Larger height for full chart
    tempContainer.id = 'temp-chart-container';
    document.body.appendChild(tempContainer);

    try {
        // Clone the chart data and layout
        const chartData = JSON.parse(JSON.stringify(chartContainer.data));
        const chartLayout = JSON.parse(JSON.stringify(chartContainer.layout));
        
        // Adjust layout for larger export size
        chartLayout.width = 1200;
        chartLayout.height = 800;
        chartLayout.margin = { l: 80, r: 150, t: 80, b: 80 }; // More space for legend
        
        // Ensure legend is fully visible
        if (chartLayout.legend) {
            chartLayout.legend.orientation = 'v';
            chartLayout.legend.x = 1.02;
            chartLayout.legend.y = 1;
            chartLayout.legend.xanchor = 'left';
            chartLayout.legend.yanchor = 'top';
        }

        // Create the temporary chart
        Plotly.newPlot(tempContainer, chartData, chartLayout, {
            responsive: false,
            displayModeBar: false,
            staticPlot: true
        }).then(() => {
            // Download the chart as PNG
            return Plotly.toImage(tempContainer, {
                format: 'png',
                width: 1200,
                height: 800,
                scale: 2 // Higher resolution
            });
        }).then((dataURL) => {
            // Create download link
            const link = document.createElement('a');
            link.download = 'chart_visualization.png';
            link.href = dataURL;
            link.click();
        }).finally(() => {
            // Clean up temporary container
            document.body.removeChild(tempContainer);
        });
    } catch (error) {
        console.error('Error downloading chart:', error);
        alert('Error downloading chart. Please try again.');
        // Clean up temporary container in case of error
        if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
        }
    }
}
const errorDetailsDiv = document.getElementById('error-details');
const errorMessageParagraph = errorDetailsDiv.querySelector('.error-message');
const lineNumbers = document.getElementById('line-numbers');

function updateLineNumbers() {
    const lines = sqlTextarea.value.split('\n');
    const lineCount = Math.max(lines.length, 20);
    let numbers = '';
    for (let i = 1; i <= lineCount; i++) {
        numbers += i + '\n';
    }
    lineNumbers.textContent = numbers.slice(0, -1);
    syncScroll();
}

function syncScroll() {
    const scrollTop = sqlTextarea.scrollTop;
    const lineHeight = parseFloat(getComputedStyle(sqlTextarea).lineHeight);
    const scrollLines = Math.floor(scrollTop / lineHeight);
    
    const lines = sqlTextarea.value.split('\n');
    const totalLines = Math.max(lines.length, 20);
    
    let visibleNumbers = '';
    for (let i = scrollLines + 1; i <= totalLines; i++) {
        visibleNumbers += i + '\n';
    }
    
    lineNumbers.textContent = visibleNumbers.slice(0, -1);
}

if (sqlTextarea && lineNumbers) {
    updateLineNumbers();
    
    sqlTextarea.addEventListener('input', () => {
        updateLineNumbers();
        // Mark query as modified but keep the loaded query reference
        isQueryModified = true;
        updateQueryInfo();
    });
    sqlTextarea.addEventListener('scroll', syncScroll);
    
    window.addEventListener('resize', updateLineNumbers);
}

if (runButton && sqlTextarea) {
    runButton.addEventListener('click', async () => {
        let query;
        // Check if text is selected
        const selectionStart = sqlTextarea.selectionStart;
        const selectionEnd = sqlTextarea.selectionEnd;
        const textareaValue = sqlTextarea.value;

        if (selectionStart !== selectionEnd) {
            // If text is selected, use only the selected text
            query = textareaValue.substring(selectionStart, selectionEnd).trim();
        } else {
            // If no text is selected, use the entire content of the textarea
            query = textareaValue.trim();
        }
        
        if (!query) {
            errorMessageParagraph.textContent = 'Please enter a SQL query or select text to run.';
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
                // *** FIX HERE: Throw the entire errorData object to retain all details ***
                throw errorData; 
            }

            const data = await response.json();
            console.log(data); // Log the response from the server

            errorMessageParagraph.textContent = ''; // Clear error message
            errorMessageParagraph.style.color = ''; // Reset color

            if (data.results && data.results.length > 0) {
                // Hide placeholder and show table
                if (tablePlaceholder) tablePlaceholder.style.display = 'none';
                resultsTable.style.display = 'table';

                // Reset sorting when new data is loaded
                currentSortColumn = null;
                currentSortDirection = null;

                // Store results globally for chart type switching
                window.lastQueryResults = data.results;

                // Render table with new data
                const headers = Object.keys(data.results[0]);
                renderTable(data.results, headers);

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
            let displayMessage = 'Unknown error occurred';

            // *** FIX HERE: Smarter error message extraction from the caught error object ***
            if (error && typeof error === 'object') {
                if (error.error && error.details) {
                    displayMessage = `${error.error}: ${error.details}`;
                } else if (error.error) {
                    displayMessage = error.error;
                } else if (error.details) {
                    displayMessage = error.details;
                } else if (error.message) { // Fallback for standard Error objects (e.g., network errors)
                    displayMessage = error.message;
                }
            } else { // Fallback for anything else that might be thrown
                displayMessage = String(error);
            }
            
            errorMessageParagraph.textContent = `Error: ${displayMessage}`;
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

// CSV download functionality
if (downloadCsvButton) {
    downloadCsvButton.addEventListener('click', downloadCSV);
}

// Chart download functionality
if (downloadChartButton) {
    downloadChartButton.addEventListener('click', downloadChart);
}

// Chart refresh functionality
const refreshChartButton = document.getElementById('refresh-chart-button');
if (refreshChartButton) {
    refreshChartButton.addEventListener('click', () => {
        // Re-generate chart with existing data without re-running query
        if (window.lastQueryResults && window.lastQueryResults.length > 0) {
            generateChart(window.lastQueryResults);
        } else {
            console.warn("No data available to refresh chart. Run a query first.");
        }
    });
}

// Save query functionality
if (saveButton && sqlTextarea) {
    saveButton.addEventListener('click', async () => {
        const query = sqlTextarea.value.trim();
        
        if (!query) {
            errorMessageParagraph.textContent = 'Please enter a SQL query to save.';
            errorMessageParagraph.style.color = '#dc2626';
            return;
        }

        try {
            let response, savedQuery;
            let action = '';
            
            if (currentLoadedQuery) {
                // Update existing loaded query
                response = await fetch(`/api/saved-queries/${currentLoadedQuery.id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        name: currentLoadedQuery.name,
                        query: query 
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw errorData;
                }
                
                savedQuery = await response.json();
                action = 'Updated';
                console.log('Query updated:', savedQuery);
                
                // Update the current loaded query reference
                currentLoadedQuery = savedQuery;
            } else {
                // Check if this query already exists
                const existingQuery = checkForDuplicateQuery(query);
                
                if (existingQuery) {
                    // Query already exists, don't create duplicate
                    errorMessageParagraph.textContent = `Query already exists as "${existingQuery.name}"`;
                    errorMessageParagraph.style.color = '#f59e0b';
                    
                    setTimeout(() => {
                        errorMessageParagraph.textContent = '';
                        errorMessageParagraph.style.color = '';
                    }, 3000);
                    
                    return;
                }
                
                // Create new query with unique name
                const newQueryName = generateUniqueQueryName();
                response = await fetch('/api/saved-queries', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ query: query, name: newQueryName })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw errorData;
                }

                savedQuery = await response.json();
                action = 'Saved as';
                console.log('Query saved:', savedQuery);
                
                // Set as current loaded query
                currentLoadedQuery = savedQuery;
            }
            
            // Reset modification flag after successful save
            isQueryModified = false;
            
            // Show success message briefly
            const originalText = errorMessageParagraph.textContent;
            const originalColor = errorMessageParagraph.style.color;
            errorMessageParagraph.textContent = `${action} "${savedQuery.name}"`;
            errorMessageParagraph.style.color = '#10b981';
            
            setTimeout(() => {
                errorMessageParagraph.textContent = originalText;
                errorMessageParagraph.style.color = originalColor;
            }, 2000);
            
            // Refresh the saved queries list and update query info
            loadSavedQueries();
            updateQueryInfo();
            
        } catch (error) {
            console.error('Error saving query:', error);
            let displayMessage = 'Failed to save query';
            
            if (error && typeof error === 'object') {
                if (error.error) {
                    displayMessage = error.error;
                } else if (error.message) {
                    displayMessage = error.message;
                }
            }
            
            errorMessageParagraph.textContent = `Error: ${displayMessage}`;
            errorMessageParagraph.style.color = '#dc2626';
        }
    });
}

// New query button functionality
if (newQueryButton && sqlTextarea) {
    newQueryButton.addEventListener('click', () => {
        // If there's a loaded query, update it first, then switch to new mode
        if (currentLoadedQuery && isQueryModified) {
            updateCurrentLoadedQuery();
        }
        
        // Clear textarea and switch to new query mode
        sqlTextarea.value = '';
        currentLoadedQuery = null;
        isQueryModified = false;
        updateQueryInfo();
        sqlTextarea.focus();
    });
}

async function updateCurrentLoadedQuery() {
    if (!currentLoadedQuery || !sqlTextarea) return;
    
    const query = sqlTextarea.value.trim();
    if (!query) return;
    
    try {
        const response = await fetch(`/api/saved-queries/${currentLoadedQuery.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                name: currentLoadedQuery.name,
                query: query 
            })
        });
        
        if (response.ok) {
            const updatedQuery = await response.json();
            console.log('Query updated:', updatedQuery);
            loadSavedQueries(); // Refresh the list
        }
    } catch (error) {
        console.error('Error updating query:', error);
    }
}

function checkForDuplicateQuery(queryText) {
    return savedQueries.find(q => q.query.trim() === queryText.trim());
}

function generateUniqueQueryName() {
    const existingNames = new Set(savedQueries.map(q => q.name));
    let queryNumber = 1;
    let queryName = `Query ${queryNumber}`;
    
    // Find the next available query number
    while (existingNames.has(queryName)) {
        queryNumber++;
        queryName = `Query ${queryNumber}`;
    }
    
    return queryName;
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
            chartDiv.style.minHeight = '300px';
        }
        if (selectedChartType === 'column') {
            createMultiStackedColumnChart(results, columns[0], columns[1], columns[2], chartContainer);
        } else if (selectedChartType === 'grouped') {
            createMultiGroupedColumnChart(results, columns[0], columns[1], columns[2], chartContainer);
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
        //errorMessageParagraph.textContent = 'Charts require 2 or 3 columns for current visualization types.';
        //errorMessageParagraph.style.color = '#dc2626';
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

// Function to create a multi-stacked column chart
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

// Function to create a multi-grouped column chart
function createMultiGroupedColumnChart(results, xColumn, groupColumn, yColumn, container) {
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
        barmode: 'group', // Key change: 'group' for grouped column chart
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

// Define the predefined layouts - calculated for 80px row height + 10px margin
const predefinedLayouts = {
    layout1: [ // Default: Stacked in three rows (total: ~360px)
        { id: 'sql-editor-item', x: 0, y: 0, w: 12, h: 3 },      // 3 * 90px = 270px
        { id: 'data-analysis-section', x: 0, y: 5, w: 12, h: 3 }, // 3 * 90px = 270px
        { id: 'data-table-section', x: 0, y: 5, w: 12, h: 3 },  // 2 * 90px = 180px  
    ],
    layout2: [ // Three Even Columns (total: ~720px)
        { id: 'sql-editor-item', x: 0, y: 0, w: 4, h: 9 },       // 8 * 90px = 720px
        { id: 'data-table-section', x: 4, y: 0, w: 4, h: 9},    // 8 * 90px = 720px
        { id: 'data-analysis-section', x: 8, y: 0, w: 4, h: 9 }  // 8 * 90px = 720px
    ],
    layout3: [ // Left 1/3 & Stacked Right 2/3 (total: ~720px)
        { id: 'sql-editor-item', x: 0, y: 0, w: 4, h: 9 },       // 8 * 90px = 720px
        { id: 'data-table-section', x: 4, y: 0, w: 8, h: 4 },    // 4 * 90px = 360px
        { id: 'data-analysis-section', x: 4, y: 4, w: 8, h: 5 }  // 4 * 90px = 360px
    ]
};

function initializeLayoutFunctionality() {
    const changeLayoutBtn = document.getElementById('change-layout-btn');
    const layoutSelectorPopup = document.getElementById('layout-selector-popup');
    const layoutOptionButtons = document.querySelectorAll('.layout-option-btn');

    if (!gridInstance) {
        console.error("GridStack instance not found. Layout change functionality disabled.");
        if (changeLayoutBtn) {
            changeLayoutBtn.disabled = true;
            changeLayoutBtn.title = "GridStack not initialized.";
        }
        return;
    }

    console.log("Initializing layout functionality with GridStack instance:", gridInstance);

    // Layout button click handler
    if (changeLayoutBtn && layoutSelectorPopup) {
        changeLayoutBtn.addEventListener('click', (event) => {
            console.log('Layout button clicked');
            event.stopPropagation();
            layoutSelectorPopup.classList.toggle('hidden');

            // Position the popup below the button
            const btnRect = changeLayoutBtn.getBoundingClientRect();
            layoutSelectorPopup.style.top = `${btnRect.bottom + 5}px`;
            layoutSelectorPopup.style.left = `${btnRect.left}px`;
        });

        // Layout option button handlers
        layoutOptionButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                console.log('Layout option clicked:', button.dataset.layout);
                event.stopPropagation();
                const layoutName = button.dataset.layout;
                applyLayout(layoutName);
                layoutSelectorPopup.classList.add('hidden');
                
                // Visual feedback - highlight selected layout
                layoutOptionButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });

        // Close popup when clicking outside
        document.addEventListener('click', (event) => {
            if (!layoutSelectorPopup.contains(event.target) && !changeLayoutBtn.contains(event.target)) {
                layoutSelectorPopup.classList.add('hidden');
            }
        });
    }

    // Apply default layout
    setTimeout(() => {
        applyLayout('layout1');
        // Set first layout button as active
        const firstLayoutBtn = document.querySelector('.layout-option-btn[data-layout="layout1"]');
        if (firstLayoutBtn) {
            firstLayoutBtn.classList.add('active');
        }
    }, 100);
}

function applyLayout(layoutName) {
    if (!gridInstance) {
        console.error('GridStack instance not available');
        return;
    }

    console.log('Applying layout:', layoutName);
    
    const layoutConfig = predefinedLayouts[layoutName];
    if (!layoutConfig) {
        console.error(`Layout '${layoutName}' not found.`);
        return;
    }

    try {
        // Method 1: Use GridStack's update method for each item
        layoutConfig.forEach(itemConfig => {
            const element = document.getElementById(itemConfig.id);
            if (element) {
                console.log(`Updating ${itemConfig.id}:`, itemConfig);
                gridInstance.update(element, {
                    x: itemConfig.x,
                    y: itemConfig.y,
                    w: itemConfig.w,
                    h: itemConfig.h
                });
            } else {
                console.warn(`Element with id ${itemConfig.id} not found`);
            }
        });

        // Compact the grid to ensure proper positioning
        gridInstance.compact();

        console.log('Layout applied successfully:', layoutName);

        // Force chart resize after layout change
        setTimeout(() => {
            const chartContainer = document.getElementById('chart-container');
            if (chartContainer && chartContainer.data && window.Plotly) {
                window.requestAnimationFrame(() => {
                    try {
                        Plotly.Plots.resize(chartContainer);
                        console.log('Chart resized after layout change');
                    } catch (e) {
                        console.log('Chart resize failed:', e);
                    }
                });
            }

            // Ensure content visibility is correct after layout change
            refreshContentVisibility();
        }, 200);

    } catch (error) {
        console.error('Error applying layout:', error);
        
        // Fallback method: Use GridStack's load method
        try {
            console.log('Trying fallback method with grid.load()');
            const serializedLayout = layoutConfig.map(item => ({
                id: item.id,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h
            }));
            
            gridInstance.load(serializedLayout, false); // false = don't add missing items
            gridInstance.compact();
            
            setTimeout(() => {
                refreshContentVisibility();
                const chartContainer = document.getElementById('chart-container');
                if (chartContainer && chartContainer.data && window.Plotly) {
                    Plotly.Plots.resize(chartContainer);
                }
            }, 200);
            
        } catch (fallbackError) {
            console.error('Fallback layout method also failed:', fallbackError);
        }
    }
}

function refreshContentVisibility() {
    // Ensure placeholders and content are properly visible after layout changes
    const resultsTable = document.getElementById('results-table');
    const tablePlaceholder = document.getElementById('table-placeholder');
    const chartContainer = document.getElementById('chart-container');
    const chartPlaceholder = document.getElementById('chart-placeholder');

    // Fix table visibility
    if (resultsTable && tablePlaceholder) {
        const hasTableData = resultsTable.style.display !== 'none' && resultsTable.innerHTML.trim() !== '';
        if (hasTableData) {
            tablePlaceholder.style.display = 'none';
            resultsTable.style.display = 'table';
        } else {
            tablePlaceholder.style.display = 'block';
            resultsTable.style.display = 'none';
        }
    }

    // Fix chart visibility
    if (chartContainer && chartPlaceholder) {
        const hasChartData = chartContainer.data && Object.keys(chartContainer.data).length > 0;
        if (hasChartData) {
            chartPlaceholder.style.display = 'none';
        } else {
            chartPlaceholder.style.display = 'block';
        }
    }

    console.log('Content visibility refreshed after layout change');
}

// Ensure GridStack and Plotly are aware of each other's resizing
document.addEventListener('DOMContentLoaded', function () {
    // Initialize GridStack with the global variable
    gridInstance = GridStack.init({
        alwaysShowResizeHandle: true,
        float: true,
        disableResize: false,
        cellHeight: 80, // Set explicit row height in pixels
        verticalMargin: 10, // Gap between rows
        // *** NEW: Designate the drag handle for GridStack items ***
        // Only elements with this class will initiate a GridStack drag.
        handle: '.grid-drag-handle',
        // *** NEW: Filter out specific elements from being draggable ***
        // Plotly chart area (its internal <canvas> or <svg> for interaction)
        // This targets the main interactive area of a Plotly chart
        filter: '.js-plotly-plot .plotly, .js-plotly-plot .svg-container, .plotly-event-overlay' 
    });

    // Store the grid instance globally for layout functions
    window.gridStackInstance = gridInstance;

    // Modified GridStack event listeners to use a blocking overlay
    gridInstance.on('resizestart dragstart', function (event, el) {
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

    gridInstance.on('resizestop dragstop', function (event, el) {
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

    gridInstance.on('change', function (event, items) {
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

    if (toggleSidebarBtn && sidebarContainer) {
        toggleSidebarBtn.addEventListener('click', () => {
            sidebarContainer.classList.toggle('collapsed');
            // Let the ResizeObserver on data-analysis-section handle the chart resize.
            // The sidebar's class change will affect .main-content's width, which affects data-analysis-section's width.
        });
    }

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
            if (sidebarContainer && sidebarContainer.classList.contains('collapsed')) {
                sidebarContainer.classList.remove('collapsed');
            }
        });
    });

    const initialActiveIcon = document.querySelector('.icon-item[data-panel="connections"]');
    if (initialActiveIcon) {
        initialActiveIcon.classList.add('active');
        const connectionsPanel = document.getElementById('connections-panel');
        if (connectionsPanel) {
            connectionsPanel.style.display = 'block';
        }
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

    // Initialize layout functionality after GridStack is ready
    initializeLayoutFunctionality();
    
    // Load database schema when page loads
    loadDatabaseSchema();
    
    // Load saved queries when page loads
    loadSavedQueries();
    
    // Prevent grid-stack scrolling when scrolling over schema panel
    const schemaPanelItems = document.querySelectorAll('.section-items');
    schemaPanelItems.forEach(items => {
        items.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: true });
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

// Saved queries functionality
let savedQueries = [];
let currentLoadedQuery = null; // Track currently loaded query
let isQueryModified = false; // Track if current query has been modified

async function loadSavedQueries() {
    try {
        console.log('Loading saved queries...');
        const response = await fetch('/api/saved-queries');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        savedQueries = await response.json();
        console.log('Saved queries loaded:', savedQueries);
        
        updateSavedQueriesUI();
        updateQueryInfo(); // Update query info after loading saved queries
        
    } catch (error) {
        console.error('Error loading saved queries:', error);
        savedQueries = [];
        updateSavedQueriesUI();
        updateQueryInfo(); // Update query info even on error
    }
}

function updateSavedQueriesUI() {
    const savedQueriesSection = document.querySelector('[data-section="saved-queries"]').nextElementSibling;
    
    if (!savedQueriesSection) {
        console.error('Saved queries section not found');
        return;
    }
    
    if (savedQueries.length === 0) {
        savedQueriesSection.innerHTML = '<div class="section-item no-items">No saved queries yet</div>';
        return;
    }
    
    savedQueriesSection.innerHTML = savedQueries.map(query => `
        <div class="section-item saved-query-item" data-query-id="${query.id}" title="${escapeHtml(query.name)}">
            <span class="query-name">${escapeHtml(query.name)}</span>
            <button class="query-menu-button" data-query-id="${query.id}">⋮</button>
        </div>
    `).join('');
    
    // Add event listeners for the menu buttons
    const menuButtons = savedQueriesSection.querySelectorAll('.query-menu-button');
    menuButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showQueryMenu(e, button.dataset.queryId);
        });
    });
}

function showQueryMenu(event, queryId) {
    const query = savedQueries.find(q => q.id === queryId);
    if (!query) return;
    
    // Remove any existing menu
    const existingMenu = document.getElementById('query-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create menu popup
    const menu = document.createElement('div');
    menu.id = 'query-context-menu';
    menu.className = 'query-context-menu';
    menu.innerHTML = `
        <button class="menu-item" data-action="rename" data-query-id="${queryId}">Rename</button>
        <button class="menu-item" data-action="load" data-query-id="${queryId}">Load</button>
        <button class="menu-item" data-action="run" data-query-id="${queryId}">Run</button>
        <button class="menu-item delete" data-action="delete" data-query-id="${queryId}">Delete</button>
    `;
    
    // Position the menu
    const rect = event.target.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '1000';
    
    document.body.appendChild(menu);
    
    // Add event listeners for menu items
    const menuItems = menu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleMenuAction(item.dataset.action, item.dataset.queryId);
            menu.remove();
        });
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

function updateQueryInfo() {
    const queryInfoElement = document.getElementById('query-info');
    if (!queryInfoElement) return;
    
    if (currentLoadedQuery) {
        // Show the name of the currently loaded query, with modification indicator
        const modifiedIndicator = isQueryModified ? ' *' : '';
        queryInfoElement.textContent = `- ${currentLoadedQuery.name}${modifiedIndicator}`;
    } else {
        // Calculate the next query number
        const nextQueryNumber = getNextQueryNumber();
        queryInfoElement.textContent = `- Query ${nextQueryNumber}`;
    }
}

function getNextQueryNumber() {
    if (savedQueries.length === 0) return 1;
    
    // Find the highest query number
    let maxNumber = 0;
    savedQueries.forEach(query => {
        const match = query.name.match(/^Query (\d+)$/);
        if (match) {
            const number = parseInt(match[1], 10);
            if (number > maxNumber) {
                maxNumber = number;
            }
        }
    });
    
    return maxNumber + 1;
}

function autoSaveCurrentQuery() {
    if (!sqlTextarea) return;
    
    const query = sqlTextarea.value.trim();
    // Check if there's any content besides spaces, tabs, and carriage returns
    if (query.length === 0) return;
    
    // If there's a loaded query and it's been modified, update it
    if (currentLoadedQuery && isQueryModified) {
        updateCurrentLoadedQuery();
        return;
    }
    
    // If there's a loaded query and it hasn't been modified, don't save
    if (currentLoadedQuery && !isQueryModified) {
        return;
    }
    
    // Only save as new query if there's no loaded query and it's not a duplicate
    if (!currentLoadedQuery) {
        const existingQuery = checkForDuplicateQuery(query);
        if (!existingQuery) {
            saveCurrentQueryContent(query);
        }
    }
}

async function saveCurrentQueryContent(query) {
    try {
        const response = await fetch('/api/saved-queries', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
            throw new Error('Failed to auto-save query');
        }

        const savedQuery = await response.json();
        console.log('Query auto-saved:', savedQuery);
        
        // Refresh the saved queries list
        loadSavedQueries();
        
    } catch (error) {
        console.error('Error auto-saving query:', error);
    }
}

async function handleMenuAction(action, queryId) {
    const query = savedQueries.find(q => q.id === queryId);
    if (!query) return;
    
    switch (action) {
        case 'rename':
            await renameQuery(queryId, query.name);
            break;
        case 'load':
            // Auto-save current query before loading new one
            autoSaveCurrentQuery();
            loadQueryIntoTextarea(query.query);
            currentLoadedQuery = query; // Track the loaded query
            isQueryModified = false; // Reset modification flag
            updateQueryInfo(); // Update the display
            break;
        case 'run':
            // Auto-save current query before running new one
            autoSaveCurrentQuery();
            loadQueryIntoTextarea(query.query);
            currentLoadedQuery = query; // Track the loaded query
            isQueryModified = false; // Reset modification flag
            updateQueryInfo(); // Update the display
            setTimeout(() => {
                if (runButton) runButton.click();
            }, 100);
            break;
        case 'delete':
            if (confirm(`Are you sure you want to delete "${query.name}"?`)) {
                await deleteQuery(queryId);
            }
            break;
    }
}

async function renameQuery(queryId, currentName) {
    const newName = prompt('Enter new name for the query:', currentName);
    if (!newName || newName === currentName) return;
    
    try {
        const response = await fetch(`/api/saved-queries/${queryId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: newName })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw errorData;
        }
        
        await loadSavedQueries();
        
    } catch (error) {
        console.error('Error renaming query:', error);
        alert('Failed to rename query: ' + (error.error || error.message || 'Unknown error'));
    }
}

async function deleteQuery(queryId) {
    try {
        const response = await fetch(`/api/saved-queries/${queryId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw errorData;
        }
        
        await loadSavedQueries();
        
    } catch (error) {
        console.error('Error deleting query:', error);
        alert('Failed to delete query: ' + (error.error || error.message || 'Unknown error'));
    }
}

function loadQueryIntoTextarea(queryText) {
    if (sqlTextarea) {
        sqlTextarea.value = queryText;
        sqlTextarea.focus();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Schema loading function
async function loadDatabaseSchema() {
    try {
        console.log('Loading database schema...');
        const response = await fetch('/schema');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const schema = await response.json();
        console.log('Schema loaded:', schema);
        
        // Update tables section
        const tablesSection = document.querySelector('[data-section="tables"]').nextElementSibling;
        if (tablesSection && schema.tables) {
            tablesSection.innerHTML = schema.tables.length > 0 
                ? schema.tables.map(table => `<div class="section-item">${table}</div>`).join('')
                : '<div class="section-item no-items">No tables found</div>';
        }
        
        // Update views section
        const viewsSection = document.querySelector('[data-section="views"]').nextElementSibling;
        if (viewsSection && schema.views) {
            viewsSection.innerHTML = schema.views.length > 0
                ? schema.views.map(view => `<div class="section-item">${view}</div>`).join('')
                : '<div class="section-item no-items">No views found</div>';
        }
        
        console.log('Schema panel updated successfully');
        
    } catch (error) {
        console.error('Error loading database schema:', error);
        
        // Show error in both sections
        const tablesSection = document.querySelector('[data-section="tables"]').nextElementSibling;
        const viewsSection = document.querySelector('[data-section="views"]').nextElementSibling;
        
        if (tablesSection) {
            tablesSection.innerHTML = '<div class="section-item error">Error loading tables</div>';
        }
        if (viewsSection) {
            viewsSection.innerHTML = '<div class="section-item error">Error loading views</div>';
        }
    }
}

// Add CSS for proper viewport sizing and GridStack height constraints
const layoutCSS = `



.grid-stack {
    
}


/* Make content areas fill available space */
.grid-stack-item-content h3 {
    flex-shrink: 0; /* Header doesn't shrink */
    margin-bottom: 10px;
}

#sql-textarea {
    flex: 1;
    min-height: 100px;
    resize: vertical;
    box-sizing: border-box;
}

.table-wrapper {
    flex: 1;
    overflow: auto;
    min-height: 120px;
}

#chart-container {
    flex: 1;
    min-height: 200px;
    overflow: hidden;
}

/* Responsive adjustments for smaller screens */
@media (max-height: 900px) {
    .grid-stack {
        height: calc(100vh - 100px) !important;
    }
}

@media (max-height: 700px) {
    .grid-stack {
        height: calc(100vh - 80px) !important;
        max-height: 600px;
    }
}

/* Schema panel styles */
.section-item.no-items {
    font-style: italic;
    color: #888;
}

.section-item.error {
    color: #dc2626;
    font-style: italic;
}
`;

// Inject CSS
const style = document.createElement('style');
style.textContent = layoutCSS;
document.head.appendChild(style);
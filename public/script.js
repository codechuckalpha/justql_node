
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

        if (runButton && sqlTextarea) {
            runButton.addEventListener('click', async () => {
                const sqlQuery = sqlTextarea.value;
                try {
                    const response = await fetch('/execute-sql', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ sql: sqlQuery })
                    });
                    const data = await response.json();
                    console.log(data); // Log the response from the server
                } catch (error) {
                    console.error('Error executing SQL:', error);
                }
            });
        }

        

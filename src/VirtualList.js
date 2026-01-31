export class VirtualList {
    constructor(containerId, rowHeight, renderRowCallback) {
        this.container = document.getElementById(containerId);
        this.rowHeight = rowHeight;
        this.renderRow = renderRowCallback;
        this.items = [];
        this.scroller = null;
        this.content = null;

        this.init();
    }

    init() {
        if (!this.container) return;

        // Clear container and setup structure
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflowY = 'auto'; // Ensure it scrolls

        // Spacer to create scroll height
        this.scroller = document.createElement('div');
        this.scroller.style.opacity = '0';
        this.scroller.style.position = 'absolute';
        this.scroller.style.top = '0';
        this.scroller.style.left = '0';
        this.scroller.style.width = '1px';
        this.scroller.style.height = '0px';
        this.container.appendChild(this.scroller);

        // Content container for visible items
        this.content = document.createElement('div');
        this.content.style.position = 'absolute';
        this.content.style.top = '0';
        this.content.style.left = '0';
        this.content.style.width = '100%';
        this.container.appendChild(this.content);

        this.container.addEventListener('scroll', () => this.onScroll());
    }

    setItems(items) {
        this.items = items;
        this.scroller.style.height = `${items.length * this.rowHeight}px`;
        this.onScroll(); // Render initial view
    }

    onScroll() {
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;

        const startIndex = Math.floor(scrollTop / this.rowHeight);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.floor((scrollTop + containerHeight) / this.rowHeight) + 1 // +1 buffer
        );

        // Render visible slice
        this.renderSlice(startIndex, endIndex);
    }

    renderSlice(start, end) {
        this.content.innerHTML = '';
        this.content.style.transform = `translateY(${start * this.rowHeight}px)`;

        for (let i = start; i <= end; i++) {
            const item = this.items[i];
            if (!item) continue;

            const rowEl = this.renderRow(item, i);
            rowEl.style.height = `${this.rowHeight}px`;
            rowEl.style.boxSizing = 'border-box';
            // Ensure strict height to match math
            rowEl.style.overflow = 'hidden';
            this.content.appendChild(rowEl);
        }
    }
}

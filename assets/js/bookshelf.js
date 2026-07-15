function getMaxLength() {
    if (window.matchMedia("(max-width: 480px)").matches) {
        return 65; // phones
    }
    if (window.matchMedia("(max-width: 768px)").matches) {
        return 260; // tablets
    }
    return 430; // desktop
}

/* Make review text toggleable */
document.querySelectorAll(".review-text").forEach(review => {
    const fullText = review.textContent.trim();
    const max_length = getMaxLength();

    if (fullText.length > max_length) {
        const shortText = fullText.slice(0, max_length);

        review.innerHTML = `
            <span class="collapsed">
                ${shortText}
                <a href="#" class="review-toggle">...more</a>
            </span>
            <span class="expanded" style="display:none">
                ${fullText}
                <a href="#" class="review-toggle"> (less)</a>
            </span>
        `;

        review.querySelectorAll(".review-toggle").forEach(link => {
            link.addEventListener("click", e => {
                e.preventDefault();

                review.querySelector(".collapsed").style.display =
                    review.querySelector(".collapsed").style.display === "none"
                        ? ""
                        : "none";

                review.querySelector(".expanded").style.display =
                    review.querySelector(".expanded").style.display === "none"
                        ? ""
                        : "none";
            });
        });
    }
});

/* edit date read format */
function formatDate(dateStr) {

    // if year only
    if (/^\d{4}$/.test(dateStr)) {
        return dateStr;
    }

    // if year and month
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
        const date = new Date(dateStr + "-01");
        return date.toLocaleDateString("en-US", {
            timeZone: "America/New_York",
            month: "short",
            year: "numeric"
        });
    }

    // if full date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split("-").map(Number);
        const date = new Date(year, month - 1, day);

        return date.toLocaleDateString("en-US", {
            timeZone: "America/New_York",
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    return dateStr;
}

document.querySelectorAll(".book-read").forEach(cell => {
    const dateStr = cell.textContent.trim();
    if (dateStr) {
        cell.textContent = formatDate(dateStr);
    }
});


/* SHELVES SECTION */
document.addEventListener("DOMContentLoaded", () => {
    const rows = document.querySelectorAll("tbody tr");
    const shelfList = document.getElementById("shelf-list");

    const counts = new Map();

    counts.set("read", rows.length); // count total read books

    rows.forEach(row => { // count every tag
        const tags = row.dataset.tags;
        if (!tags) return;

        tags.split(",").forEach(tag => {
            tag = tag.trim();
            counts.set(tag, (counts.get(tag) || 0) + 1);
        });
    });

    // read shelf
    shelfList.insertAdjacentHTML(
        "beforeend",
        `
        <ul>
            <a href="#" data-filter="read">
                read <span>(${rows.length})</span>
            </a>
        </ul>
        `
    );

    // other shelves
    [...counts.entries()]
        .filter(([tag]) => tag !== "read")
        .sort(([a], [b]) => a.localeCompare(b)) // alphabetical ordering
        .forEach(([tag, count]) => {
            shelfList.insertAdjacentHTML(
                "beforeend",
                `
                <ul>
                    <a href="#" data-filter="${tag}">
                        ${tag.charAt(0)+ tag.slice(1)}
                        <span>(${count})</span>
                    </a>
                </ul>
                `
            );
        });

    // filter displayed books based on shelf
    shelfList.addEventListener("click", e => {
        const link = e.target.closest("[data-filter]");
        if (!link) return;

        e.preventDefault();
        const filter = link.dataset.filter;

        rows.forEach(row => {
            if (filter === "read") {
                row.style.display = "";
                return;
            }

            const tags = (row.dataset.tags || "").split(",");
            row.style.display = tags.includes(filter) ? "" : "none";
        });
    });
});
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
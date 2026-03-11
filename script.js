<script>
    const panels = document.querySelectorAll('[data-panel]');
    const quotes = document.querySelectorAll('[data-quote]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // activar quote correspondiente
                const index = [...panels].indexOf(entry.target);
                if (quotes[index]) quotes[index].classList.add('active');
            } else {
                entry.target.classList.remove('active');
                const index = [...panels].indexOf(entry.target);
                if (quotes[index]) quotes[index].classList.remove('active');
            }
        });
    }, { threshold: 0.3 });

    panels.forEach(panel => observer.observe(panel));
</script>
export const tooltip = (el: HTMLElement) => {
    el.classList.add('tooltip');
    el.setAttribute('tabindex', '0');

    function handleFocus() {
        const text = el.getAttribute('aria-label');

        const child = document.createElement('span');
        child.textContent = text;
        child.setAttribute('id', 'tooltip');
        el.appendChild(child);

        el.addEventListener('mouseleave', handleBlur);
        el.addEventListener('blur', handleBlur);
        el.removeEventListener('mouseenter', handleFocus);
        el.removeEventListener('focus', handleFocus);
    }

    function handleBlur() {
        el.removeChild(el.querySelector('#tooltip')!);

        el.removeEventListener('mouseleave', handleBlur);
        el.removeEventListener('blur', handleBlur);
        el.addEventListener('mouseenter', handleFocus);
        el.addEventListener('focus', handleFocus);
    }

    el.addEventListener('mouseenter', handleFocus);
    el.addEventListener('focus', handleFocus);

    return {
        destroy() {
            el.classList.remove('tooltip');
            el.removeEventListener('mouseenter', handleFocus);
            el.removeEventListener('focus', handleFocus);
        }
    };
};
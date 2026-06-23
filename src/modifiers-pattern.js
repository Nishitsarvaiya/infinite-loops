import gsap from 'gsap';

const track = document.querySelector('.marquee__track');
let period = track.offsetWidth / 2;
const wrapX = gsap.utils.wrap(-period, 0);

gsap.to(track, {
	x: `-${period}`,
	duration: 5,
	ease: 'none',
	repeat: -1,
	modifiers: {
		x: (xValue) => {
			return wrapX(parseFloat(xValue)) + 'px';
		},
	},
});

window.addEventListener('resize', () => (period = track.offsetWidth / 2), { passive: true });

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./*.html', './js/**/*.js'],
    theme: {
        extend: {
            screens: {
                // Palier bas : sous 400px le header n'a pas la place
                // d'afficher le libellé du CTA à côté du burger.
                xs: '400px'
            },
            colors: {
                fond: '#E9F5F1',
                vert: {
                    DEFAULT: '#07391D',
                    clair: '#0F5C31',
                    pale: '#CCE2DA'
                },
                cta: {
                    DEFAULT: '#F97A12',
                    fonce: '#D9630A',
                    pale: '#FFF4EA'
                },
                vertc: '#41CF1A',
                // Texte posé sur l'orange : le blanc tombe à 2,69:1 (sous le
                // seuil WCAG AA). Ce vert atteint 4,85:1. Ne jamais remplacer
                // par text-white sur un fond bg-cta.
                surcta: '#07391D',
                gris: {
                    DEFAULT: '#54635E',
                    clair: '#9EAFA9',
                    bord: '#DCE5EE'
                },
                erreur: '#C81E1E'
            },
            fontFamily: {
                titre: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
                corps: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
            },
            borderRadius: {
                pill: '3.125rem'
            },
            maxWidth: {
                site: '78.625rem',
                article: '54.75rem'
            },
            boxShadow: {
                carte: '0 1px 3px rgba(7,57,29,0.06), 0 4px 16px rgba(7,57,29,0.06)',
                'carte-hover': '0 4px 12px rgba(7,57,29,0.08), 0 12px 32px rgba(7,57,29,0.10)',
                modale: '0 24px 64px rgba(7,57,29,0.24)'
            },
            letterSpacing: {
                titre: '-0.022em'
            },
            keyframes: {
                apparition: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                deplier: {
                    '0%': { opacity: '0', maxHeight: '0' },
                    '100%': { opacity: '1', maxHeight: '30rem' }
                }
            },
            animation: {
                apparition: 'apparition 0.35s ease-out',
                deplier: 'deplier 0.4s ease-out'
            }
        }
    },
    plugins: []
};

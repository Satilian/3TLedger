import { Link } from '@satilian/router';

export function NotFound() {
  return (
    <div
      style={{
        display: 'grid',
        alignContent: 'center',
        justifyContent: 'center',
        minHeight: '90svh',
        textAlign: 'center',
        fontSize: '22px',
      }}
    >
      <h2> ❌ Page Not Found</h2>
      <p>К сожалению, страница не найдена.</p>
      <p>
        Пожалуйста, проверьте URL или вернитесь на <Link to="/">главную страницу</Link>.
      </p>
    </div>
  );
}

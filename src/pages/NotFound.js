function NotFound() {
  return (
    <div className="content" style={{ textAlign: "center" }}>
      <h1>404</h1>
      <p>Page not found</p>

      <a href="/" style={{ color: "#3b82f6" }}>
        Go back home
      </a>
    </div>
  );
}

export default NotFound;
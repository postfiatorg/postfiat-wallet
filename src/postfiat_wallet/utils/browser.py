import webbrowser

def launch_browser(url: str) -> None:
    """Launch the default web browser with the given URL."""
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Failed to open browser: {e}")

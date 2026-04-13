
# Turing Machine Emulator for Binary Arithmetic



A web-based emulator that simulates a strictly defined Turing Machine to perform binary arithmetic (addition and subtraction). It seamlessly handles complex expressions with multiple operands sequenced together.

## 🚀 Features

- **Binary Addition & Subtraction:** Fully simulates bitwise operations modeling mathematical logic.
- **Multi-Operand Chaining:** Supports chaining up to 10 binary numbers in a single expression (e.g., `101+11-10+1`).
- **Visual Step-by-Step Simulation:** The backend generates exhaustive tape movements (Right, Left, Stay), symbol reads/writes, and state changes mimicking a traditional 7-tuple Formal Definition.
- **Input Validation:** Automatically pre-validates inputted strings preventing illegal characters or syntax errors before execution.

## 🛠️ Technology Stack

- **Backend Logic:** Python 3 (`turing_machine.py`)
- **API Server:** Flask (`app.py`) + Flask-CORS 
- **Frontend:** HTML, CSS, JavaScript (`templates/index.html` & `static/`)
- **Testing:** Pytest (`test_turing_machine.py`)

## 📦 Project Structure

```text
├── app.py                     # Main Flask Application & API Routes
├── turing_machine.py          # Core Turing Machine Logic & State Generation
├── test_turing_machine.py     # Unit Tests for Arithmetic Functions
├── requirements.txt           # Python Package Dependencies
├── run.bat                    # Windows Batch script to launch the app instantly
├── templates/                 
│   └── index.html             # Frontend User Interface
└── static/                    # Assumed CSS/JS assets (if any)
```

## ⚙️ Installation & Usage

1. **Clone the repository** (or navigate to the project directory).
2. **Install dependencies:**
   It is highly recommended to use a virtual environment.
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the server:**
   You can either run the Python file directly:
   ```bash
   python app.py
   ```
   *Or* double-click the `run.bat` script on Windows.
4. **Open the App:** Navigate to `http://localhost:5000` in your web browser.

## 🔗 Documentation

### API Routes

*   **`GET /`** - Serves the web-based visual interface.
*   **`POST /simulate`** - Receives `{ "input": "10+11" }` and returns a JSON payload containing the final calculation tape, array of head movements, intermediate results, and accept/reject status.
*   **`POST /validate`** - Pre-validates the expression verifying character validity (limits to `0`, `1`, `+`, `-`) and length capping.

## 🧠 How It Works (Under the Hood)

For visualizing purposes, the application breaks operational logic down to mimic Turing machine behaviors:
*   **States (`Q`)**: Emulated states like `q0`, `q_add`, `q_carry`, `q_borrow`, `q_cleanup`, `q_accept`, and `q_reject`.
*   **Tape Alphabet (`Γ`) / Symbols**: Uses `0, 1, +, -` and `B` for `Blank`.
*   The script calculates arithmetic sub-operations piece-by-piece, sequentially appending changes so the UI can animate the mechanical reading and writing.

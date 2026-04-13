from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from turing_machine import TuringMachine

app = Flask(__name__)
CORS(app)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.get_json()
    if not data or 'input' not in data:
        return jsonify({'status': 'error', 'error': 'Missing "input" field in request body.'}), 400

    user_input = data['input'].strip()
    if not user_input:
        return jsonify({'status': 'error', 'error': 'Input cannot be empty.'}), 400

    tm = TuringMachine(user_input)
    result = tm.run()
    return jsonify(result)


@app.route('/validate', methods=['POST'])
def validate():
    data = request.get_json()
    if not data or 'input' not in data:
        return jsonify({'valid': False, 'message': 'Missing input.'}), 400

    user_input = data['input'].strip()
    tm = TuringMachine(user_input)
    valid, message = tm.validate_input()
    return jsonify({'valid': valid, 'message': message})


if __name__ == '__main__':
    print("Turing Machine Emulator Server starting on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)

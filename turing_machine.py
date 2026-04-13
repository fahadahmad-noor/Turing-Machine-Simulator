"""
Turing Machine Emulator for Binary Arithmetic (Addition & Subtraction)
Supports multiple operands (up to 10 numbers chained with + and - operators).
Formal 7-Tuple Definition:
Q = Set of states, Σ = Input alphabet {0,1,+,-}, Γ = Tape alphabet {0,1,+,-,B}
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
import re


@dataclass
class Transition:
    write: str
    move: str   # 'L' or 'R' or 'S' (stay)
    next_state: str


@dataclass
class StepRecord:
    step_number: int
    state: str
    head: int
    tape: List[str]
    read_symbol: str
    write_symbol: str
    move_direction: str
    next_state: str


class TuringMachine:
    """
    Turing Machine for Binary Addition and Subtraction.
    Supports multiple operands chained with + and - operators.
    E.g., "101+11-10+1" processes left to right.

    States:
        q0          - Start state: scan/validate input
        q_find_op   - Find the operator
        q_op_found  - Operator found, determine type
        q_add_start - Navigate for addition
        q_sub_start - Navigate for subtraction
        q_accept    - Halt, accept
        q_reject    - Halt, reject (invalid input)
    """

    BLANK = 'B'

    def __init__(self, input_string: str):
        self.original_input = input_string.strip()
        self.tape: List[str] = []
        self.head: int = 0
        self.current_state: str = 'q0'
        self.steps: List[StepRecord] = []
        self.step_count: int = 0
        self.transitions: Dict[str, Transition] = {}
        self._setup_tape()

    def _setup_tape(self):
        """Initialize the tape from the input string."""
        self.tape = list(self.original_input) + [self.BLANK]
        self.head = 0
        self.current_state = 'q0'
        self.steps = []
        self.step_count = 0

    def _setup_tape_from(self, input_str: str):
        """Initialize tape from a specific string (for multi-step operations)."""
        self.tape = list(input_str) + [self.BLANK]
        self.head = 0

    def _record_step(self, read_sym: str, write_sym: str, move: str, next_state: str):
        """Record a single machine step."""
        self.steps.append(StepRecord(
            step_number=self.step_count,
            state=self.current_state,
            head=self.head,
            tape=list(self.tape),
            read_symbol=read_sym,
            write_symbol=write_sym,
            move_direction=move,
            next_state=next_state
        ))
        self.step_count += 1

    def _move_head(self, direction: str):
        """Move the head L, R, or S."""
        if direction == 'R':
            self.head += 1
            if self.head >= len(self.tape):
                self.tape.append(self.BLANK)
        elif direction == 'L':
            if self.head > 0:
                self.head -= 1

    @staticmethod
    def parse_expression(s: str) -> Tuple[List[str], List[str]]:
        """
        Parse a multi-operand expression like '101+11-10+1'
        Returns (operands, operators) where:
          operands = ['101', '11', '10', '1']
          operators = ['+', '-', '+']
        """
        # Split on + or - while keeping the delimiters
        tokens = re.split(r'(\+|\-)', s)
        operands = []
        operators = []
        for i, token in enumerate(tokens):
            if i % 2 == 0:
                operands.append(token)
            else:
                operators.append(token)
        return operands, operators

    def validate_input(self) -> Tuple[bool, str]:
        """Validate the input string for multi-operand expressions."""
        s = self.original_input
        allowed = set('01+-')
        # Check characters
        for ch in s:
            if ch not in allowed:
                return False, f"Invalid character '{ch}'. Allowed: 0, 1, +, -"

        # Parse expression
        operands, operators = self.parse_expression(s)

        # Must have at least one operator
        if len(operators) == 0:
            return False, "No operator found. Input must contain '+' or '-'."

        # Must have at least 2 operands
        if len(operands) < 2:
            return False, "At least two operands are required."

        # Check each operand
        for i, op in enumerate(operands):
            if not op:
                if i == 0:
                    return False, "No first operand before the operator."
                elif i == len(operands) - 1:
                    return False, "No operand after the last operator."
                else:
                    return False, f"Empty operand at position {i + 1}."
            if not all(c in '01' for c in op):
                return False, f"Operand '{op}' is not valid binary (only 0s and 1s allowed)."

        # Limit to 10 operands
        if len(operands) > 10:
            return False, "Maximum 10 operands supported."

        return True, "Valid"

    def run(self) -> dict:
        """
        Execute the Turing Machine simulation for multi-operand expressions.
        Processes left to right: a op1 b op2 c ... 
        Returns a dict with steps, result, status, etc.
        """
        valid, msg = self.validate_input()
        if not valid:
            self.current_state = 'q0'
            if self.tape:
                read_sym = self.tape[self.head] if self.head < len(self.tape) else self.BLANK
                self._record_step(read_sym, read_sym, 'S', 'q_reject')
            self.current_state = 'q_reject'
            return {
                'status': 'rejected',
                'error': msg,
                'steps': self._serialize_steps(),
                'result': None
            }

        operands, operators = self.parse_expression(self.original_input)

        # Process the full expression on the original tape first (scan phase)
        self._simulate_full_scan()

        # Now process operands left-to-right
        accumulator = operands[0]
        intermediate_results = [accumulator]

        for i, operator in enumerate(operators):
            right = operands[i + 1]
            # Set up tape for this sub-operation
            sub_input = accumulator + operator + right
            self._setup_tape_from(sub_input)

            # Find operator position in sub-expression
            op_idx = len(accumulator)

            self._simulate_navigate_lsb(op_idx, operator)

            if operator == '+':
                result_bits = self._simulate_addition(accumulator, right)
            else:
                result_bits = self._simulate_subtraction(accumulator, right)

            accumulator = result_bits
            intermediate_results.append(accumulator)

        # Final cleanup
        self._simulate_cleanup(accumulator)

        # Final tape state
        final_tape = list(accumulator) + [self.BLANK]
        self.tape = final_tape
        self.head = 0

        return {
            'status': 'accepted',
            'error': None,
            'steps': self._serialize_steps(),
            'result': accumulator,
            'operands': operands,
            'operators': operators,
            'intermediate_results': intermediate_results,
            # Keep backward compatibility
            'operator': operators[0] if len(operators) == 1 else operators[0],
            'left_operand': operands[0],
            'right_operand': operands[1] if len(operands) > 1 else '',
        }

    def _simulate_full_scan(self):
        """Simulate q0: scanning the entire input expression."""
        self._setup_tape()
        # Scan from left to right across the entire input
        while self.head < len(self.tape) and self.tape[self.head] != self.BLANK:
            sym = self.tape[self.head]
            if sym in '01':
                next_st = 'q0'
                move = 'R'
            elif sym in '+-':
                next_st = 'q_find_op'
                move = 'R'
            else:
                next_st = 'q_reject'
                move = 'S'
            self._record_step(sym, sym, move, next_st)
            self.current_state = next_st
            self._move_head(move)

    def _simulate_navigate_lsb(self, op_idx: int, operator: str):
        """Simulate navigation to LSB."""
        state = 'q_add_start' if operator == '+' else 'q_sub_start'
        # Move back left to LSB (rightmost non-blank)
        while self.head > 0 and (self.head >= len(self.tape) or self.tape[self.head] == self.BLANK):
            sym = self.tape[self.head] if self.head < len(self.tape) else self.BLANK
            self._record_step(sym, sym, 'L', state)
            self.current_state = state
            self._move_head('L')

        if self.head < len(self.tape):
            sym = self.tape[self.head]
            self._record_step(sym, sym, 'S', state)
            self.current_state = state

    def _simulate_addition(self, left: str, right: str) -> str:
        """Simulate binary addition steps on the tape."""
        max_len = max(len(left), len(right))
        left_p = left.zfill(max_len)
        right_p = right.zfill(max_len)
        carry = 0
        result_bits = []
        for i in range(max_len - 1, -1, -1):
            bit_a = int(left_p[i])
            bit_b = int(right_p[i])
            total = bit_a + bit_b + carry
            result_bit = total % 2
            new_carry = total // 2
            next_state = 'q_carry' if new_carry else 'q_add'
            self._record_step(
                str(bit_a), str(result_bit), 'L',
                next_state
            )
            self.current_state = next_state
            carry = new_carry
            result_bits.insert(0, str(result_bit))
        if carry:
            self._record_step('B', '1', 'L', 'q_carry')
            self.current_state = 'q_carry'
            result_bits.insert(0, '1')
        return ''.join(result_bits)

    def _simulate_subtraction(self, left: str, right: str) -> str:
        """Simulate binary subtraction steps on the tape."""
        int_a = int(left, 2)
        int_b = int(right, 2)
        negative = int_a < int_b
        if negative:
            a, b = right, left
        else:
            a, b = left, right

        max_len = max(len(a), len(b))
        a_p = a.zfill(max_len)
        b_p = b.zfill(max_len)
        borrow = 0
        result_bits = []

        for i in range(max_len - 1, -1, -1):
            bit_a = int(a_p[i])
            bit_b = int(b_p[i])
            diff = bit_a - bit_b - borrow
            if diff < 0:
                diff += 2
                borrow = 1
                next_state = 'q_borrow'
            else:
                borrow = 0
                next_state = 'q_subtract'
            self._record_step(str(bit_a), str(diff), 'L', next_state)
            self.current_state = next_state
            result_bits.insert(0, str(diff))

        result_str = ''.join(result_bits).lstrip('0') or '0'
        return result_str

    def _simulate_cleanup(self, result: str):
        """Simulate the q_cleanup phase — format the final tape."""
        self.tape = list(result) + [self.BLANK]
        self.head = 0
        for i, bit in enumerate(result):
            self._record_step(bit, bit, 'R', 'q_cleanup')
            self.current_state = 'q_cleanup'
            self.head = i + 1
        self._record_step(self.BLANK, self.BLANK, 'S', 'q_accept')
        self.current_state = 'q_accept'

    def _serialize_steps(self) -> List[dict]:
        return [
            {
                'step': s.step_number,
                'state': s.state,
                'head': s.head,
                'tape': s.tape,
                'read': s.read_symbol,
                'write': s.write_symbol,
                'move': s.move_direction,
                'next_state': s.next_state
            }
            for s in self.steps
        ]

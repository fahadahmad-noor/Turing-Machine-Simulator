"""
Unit tests for Turing Machine binary arithmetic.
Run: pytest test_turing_machine.py -v
"""
import pytest
from turing_machine import TuringMachine


def simulate(expr):
    tm = TuringMachine(expr)
    return tm.run()


class TestAddition:
    def test_simple_add(self):
        r = simulate('101+11')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == int('101', 2) + int('11', 2)

    def test_add_with_carry(self):
        r = simulate('1111+1')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == 0b1111 + 0b1

    def test_add_equals(self):
        r = simulate('11+11')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == 6

    def test_add_zeroes(self):
        r = simulate('0+0')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == 0

    def test_add_large(self):
        r = simulate('1010+1010')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == 20


class TestSubtraction:
    def test_simple_sub(self):
        r = simulate('1100-101')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == 0b1100 - 0b101

    def test_sub_borrow(self):
        r = simulate('1000-1')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == 7

    def test_sub_equal(self):
        r = simulate('101-101')
        assert r['status'] == 'accepted'
        assert int(r['result'], 2) == 0


class TestValidation:
    def test_invalid_char(self):
        r = simulate('102+01')
        assert r['status'] == 'rejected'

    def test_no_operator(self):
        r = simulate('101')
        assert r['status'] == 'rejected'

    def test_multiple_operators(self):
        r = simulate('101+10+1')
        assert r['status'] == 'rejected'

    def test_empty_right(self):
        r = simulate('101+')
        assert r['status'] == 'rejected'

    def test_empty_left(self):
        r = simulate('+101')
        assert r['status'] == 'rejected'


class TestStepRecording:
    def test_steps_recorded(self):
        r = simulate('11+1')
        assert len(r['steps']) > 0

    def test_steps_have_required_keys(self):
        r = simulate('10+1')
        for step in r['steps']:
            assert 'state' in step
            assert 'head' in step
            assert 'tape' in step
            assert 'read' in step
            assert 'write' in step
            assert 'move' in step
            assert 'next_state' in step

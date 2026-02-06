#!/usr/bin/env python3
"""
Generate and display the first 20 Fibonacci numbers.
"""

def generate_fibonacci(n):
    """
    Generate the first n Fibonacci numbers.
    
    Args:
        n: Number of Fibonacci numbers to generate
        
    Returns:
        List of the first n Fibonacci numbers
    """
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    
    fibonacci = [0, 1]
    
    for i in range(2, n):
        fibonacci.append(fibonacci[i-1] + fibonacci[i-2])
    
    return fibonacci


def main():
    """Main function to generate and display Fibonacci numbers."""
    n = 20
    fib_numbers = generate_fibonacci(n)
    
    print(f"The first {n} Fibonacci numbers are:")
    print("-" * 40)
    
    for i, num in enumerate(fib_numbers):
        print(f"F({i}): {num}")
    
    print("-" * 40)
    print(f"The {n}th Fibonacci number is: {fib_numbers[-1]}")


if __name__ == "__main__":
    main()

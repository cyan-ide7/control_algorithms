import numpy as np
import scipy.linalg as la

# 1. Your Physical Rig Parameters
Mc = 0.57      # Cart mass (kg)
Mp = 0.127     # Bob mass (kg)
L = 0.33       # Pole length (m)
g = 9.81       # Gravity
Mt = Mc + Mp

# 2. Linearized Physics Matrices (A and B)
# State vector: [theta, omega, x, v]
# (Quanser convention: positive theta means leaning left)
A = np.array([
    [0, 1, 0, 0],
    [(Mt * g) / (Mc * L), 0, 0, 0],
    [0, 0, 0, 1],
    [(Mp * g) / Mc, 0, 0, 0]
])

B = np.array([
    [0],
    [1 / (Mc * L)],
    [0],
    [1 / Mc]
])

# 3. Define your LQR "Budget" (Costs)
# We care A LOT about angle (10000) to keep it balanced like a PID controller
# We put a smaller penalty on position (100) so it doesn't violently chase the center at the cost of dropping the ball
Q = np.diag([10000, 1, 100, 1]) 

# R Matrix: Penalize motor effort
# Lower number means the motor is allowed to work harder. We decrease it to 0.05 for fast, aggressive corrections.
R = np.array([[0.05]])           

# 4. Solve the Continuous Riccati Equation
P = la.solve_continuous_are(A, B, Q, R)

# 5. Calculate the Optimal Feedback Gains (K)
K = np.linalg.inv(R) @ B.T @ P

print("\n--- OPTIMAL LQR GAINS ---")
print("Put these exact values into your controllers.js:")
print(f"K1 (theta): {-K[0][0]:.2f}")
print(f"K2 (omega): {-K[0][1]:.2f}")
print(f"K3 (x):     {K[0][2]:.2f}") 
print(f"K4 (xdot):  {K[0][3]:.2f}")
print("-------------------------\n")

import numpy as np
import scipy.linalg

Mc = 0.5
Mp1 = 0.127
L1 = 0.3302
I1 = 0.0184

Mp2 = 0.127
L2 = 0.3302
I2 = 0.0184

g = 9.81
L_hinge = 2 * L1

M11 = Mc + Mp1 + Mp2
M12 = -(Mp1 * L1 + Mp2 * L_hinge)
M13 = -Mp2 * L2
M21 = M12
M22 = I1 + Mp2 * L_hinge**2
M23 = Mp2 * L_hinge * L2
M31 = M13
M32 = M23
M33 = I2

M = np.array([[M11, M12, M13],
              [M21, M22, M23],
              [M31, M32, M33]])

K22 = -(Mp1 * L1 + Mp2 * L_hinge) * g
K33 = -Mp2 * L2 * g

K = np.zeros((3, 3))
K[1, 1] = K22
K[2, 2] = K33

B_force = np.array([[1], [0], [0]])

M_inv = np.linalg.inv(M)
A21 = -M_inv @ K
B2 = M_inv @ B_force

A = np.zeros((6, 6))
A[0:3, 3:6] = np.eye(3)
A[3:6, 0:3] = A21

B = np.zeros((6, 1))
B[3:6, :] = B2

# Heavily penalize cart position and velocity
Q = np.diag([2000, 300, 500, 1000, 50, 50])
R = np.array([[1]])

P = scipy.linalg.solve_continuous_are(A, B, Q, R)
K_lqr = np.linalg.inv(R) @ B.T @ P

print('K_lqr:', K_lqr[0])

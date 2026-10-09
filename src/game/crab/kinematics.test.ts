import { describe, expect, it } from 'vitest';
import { AIR_HOP, CrabRobot } from '../CrabRobot';
import { footOf, SERVO_JOINTS, servoAngles, skeleton } from './kinematics';

const leg = (name: string, jumpT: number) => skeleton(jumpT, 0).find((item) => item.name === name)!;

describe('jumper kinematics', () => {
  it('stands with every foot below the body', () => {
    const pose = skeleton(-1, 0);
    expect(pose.map((item) => item.name)).toEqual(['LF', 'RF', 'LM', 'RM', 'LR', 'RR']);
    for (const item of pose) expect(footOf(item.links)[2]).toBeLessThan(-0.05);
    expect(footOf(leg('LM', -1).links)[1]).toBeGreaterThan(0.15);
    expect(footOf(leg('RM', -1).links)[1]).toBeLessThan(-0.15);
  });

  it('crouches the feet up and then pushes them down', () => {
    const stand = footOf(leg('LM', -1).links)[2];
    const crouch = footOf(leg('LM', 0.045).links)[2];
    const push = footOf(leg('LM', 0.11).links)[2];
    expect(crouch).toBeGreaterThan(stand);
    expect(push).toBeLessThan(stand);
  });

  it('gives the front claws a finger branch', () => {
    expect(leg('LF', -1).finger).toHaveLength(3);
    expect(leg('LM', -1).finger).toBeUndefined();
  });

  it('commands every one of the 22 servos', () => {
    const pose = servoAngles(-1, 0);
    expect(Object.keys(pose)).toEqual([...SERVO_JOINTS]);
    expect(pose.LF_J0_joint).toBeCloseTo(-0.5507);
    expect(pose.LF_J4_joint).toBeCloseTo(0);
    expect(pose.RF_J3_joint).toBeCloseTo(1.4173);
    expect(pose.RR_J2_joint).toBeCloseTo(1.8678);
    const push = servoAngles(0.11, 0);
    expect(push.LM_J1_joint).not.toBeCloseTo(pose.LM_J1_joint);
    expect(push.LF_J1_joint).toBeGreaterThan(pose.LF_J1_joint);
  });

  it('tucks the legs while falling and lifts a swing leg while crawling', () => {
    const stand = footOf(leg('LM', -1).links)[2];
    const tucked = footOf(skeleton(-1, 0, 0, 1).find((item) => item.name === 'LM')!.links)[2];
    expect(tucked).toBeGreaterThan(stand);
  });

  it('keeps every servo inside the URDF range', () => {
    const range: Record<string, readonly [number, number]> = {
      LF_J0_joint: [-2.75, 0.7], LF_J1_joint: [-4.75, 1.4], LF_J2_joint: [-2.2, 1.65], LF_J3_joint: [-2.1, 1.65], LF_J4_joint: [-1.6, 0.1],
      RF_J0_joint: [-0.7, 2.75], RF_J1_joint: [-4.75, 1.4], RF_J2_joint: [-1.65, 2.1], RF_J3_joint: [-1.65, 2.1], RF_J4_joint: [-0.1, 1.6],
      LM_J0_joint: [-0.75, 1], LM_J1_joint: [-2.4, 1.5], LM_J2_joint: [-2.4, 1.8],
      RM_J0_joint: [-1, 0.75], RM_J1_joint: [-1.5, 2.4], RM_J2_joint: [-1.8, 2.4],
      LR_J0_joint: [-0.6, 2.75], LR_J1_joint: [-2.4, 1.6], LR_J2_joint: [-2.4, 1.8],
      RR_J0_joint: [-2.75, 0.6], RR_J1_joint: [-1.6, 2.4], RR_J2_joint: [-1.8, 2.4]
    };
    const samples = [0, 0.05, 0.2, 0.45, 0.8, 1.3];
    for (const time of samples) {
      for (const heading of [1, -1]) {
        const poses = [
          servoAngles(-1, time, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, heading),
          servoAngles(0.045, time, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, heading),
          servoAngles(0.11, time, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, heading)
        ];
        for (const pose of poses) {
          for (const name of SERVO_JOINTS) {
            const [lo, hi] = range[name];
            expect(pose[name], name).toBeGreaterThanOrEqual(lo - 1e-9);
            expect(pose[name], name).toBeLessThanOrEqual(hi + 1e-9);
          }
        }
      }
    }
  });

  it('lifts one tetrapod pair and keeps the other four down', () => {
    const mid = (1 / 3 + 1 / 6) * 2 * Math.PI / 10;
    const pose = skeleton(-1, mid, 1);
    const z = (name: string) => footOf(pose.find((item) => item.name === name)!.links)[2];
    expect(z('LM')).toBeGreaterThan(z('LR'));
    expect(z('RM')).toBeGreaterThan(z('RR'));
    expect(z('LF')).toBeLessThan(z('LM'));
    expect(z('RF')).toBeLessThan(z('RM'));
    const still = servoAngles(-1, mid, 0);
    const moving = servoAngles(-1, mid, 1);
    expect(moving.LM_J1_joint).not.toBeCloseTo(still.LM_J1_joint);
    expect(moving.RM_J1_joint).not.toBeCloseTo(moving.RR_J1_joint);
  });

  it('keeps the tetrapod after the shell turns around', () => {
    const mid = (1 / 3 + 1 / 6) * 2 * Math.PI / 10;
    const fore = servoAngles(-1, mid, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
    const back = servoAngles(-1, mid, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1);
    expect(back.LM_J0_joint).toBeCloseTo(fore.LM_J0_joint);
    expect(back.RM_J1_joint).toBeCloseTo(fore.RM_J1_joint);
    expect(back.LF_J1_joint).toBeCloseTo(fore.LF_J1_joint);
    for (const heading of [1, -1] as const) {
      const early = (1 / 3) * 2 * Math.PI / 10;
      const late = (1 / 3 + 0.3) * 2 * Math.PI / 10;
      const backFoot = footOf(skeleton(-1, early, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, heading).find((item) => item.name === 'RM')!.links);
      const foreFoot = footOf(skeleton(-1, late, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, heading).find((item) => item.name === 'RM')!.links);
      expect(foreFoot[0]).toBeGreaterThan(backFoot[0]);
    }
  });
});

describe('CrabRobot', () => {
  it('turns a connectome flap into the same upward impulse as the old body', () => {
    const crab = new CrabRobot();
    crab.flap();
    expect(crab.velocityY).toBe(AIR_HOP);
    crab.update(0.05);
    expect(crab.y).toBeLessThan(320);
    expect(crab.skeleton()).toHaveLength(6);
  });
});

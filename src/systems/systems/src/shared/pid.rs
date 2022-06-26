use std::time::Duration;

#[derive(PartialEq, Clone, Copy)]
/// Pid controller implementation
/// Implementation in a recursive form
/// u(k+1) = u(k) + (e(k) - e(k-1)) * Kp + e(k) * Ki * dt + (e(k) - 2 * e(k-1) + e(k-2)) * Kd / dt
/// For variable dt add dt duration as argument, if fixed dt or scheduled synchronously with controlled system input None as dt
pub struct PidController {
    kp: f64,
    ki: f64,
    kd: f64,

    min_output: f64,
    max_output: f64,

    setpoint: f64,

    error_k_1: Option<f64>,
    error_k_2: Option<f64>,

    output: f64,
    output_gain: f64,
}

impl PidController {
    pub fn new(
        kp: f64,
        ki: f64,
        kd: f64,
        min_output: f64,
        max_output: f64,
        setpoint: f64,
        output_gain: f64,
    ) -> Self {
        Self {
            kp,
            ki,
            kd,
            min_output,
            max_output,
            setpoint,
            error_k_1: None,
            error_k_2: None,
            output: 0.,
            output_gain,
        }
    }

    pub fn change_setpoint(&mut self, new_setpoint: f64) {
        self.setpoint = new_setpoint;
    }

    pub fn set_min_output(&mut self, new_min: f64) {
        self.min_output = new_min;
    }

    pub fn set_max_output(&mut self, new_max: f64) {
        self.max_output = new_max;
    }

    pub fn setpoint(&self) -> f64 {
        self.setpoint
    }

    pub fn output(&self) -> f64 {
        self.output
    }

    pub fn reset(&mut self) {
        self.output = 0.;
        self.reset_error();
    }

    pub fn reset_with_output(&mut self, output: f64) {
        self.output = output;
        self.reset_error();
    }

    pub fn next_control_output(&mut self, measurement: f64, delta_time: Option<Duration>) -> f64 {
        let dt = delta_time.map(|d| d.as_secs_f64()).unwrap_or(1.);

        let error = self.setpoint - measurement;
        let p_term = (error - self.error_k_1.unwrap_or(0.)) * self.kp;
        let i_term = error * self.ki * dt;

        let d_term = self
            .error_k_1
            .zip(self.error_k_2)
            .map(|(error_k_1, error_k_2)| (error - 2. * error_k_1 + error_k_2) * self.kd / dt)
            .unwrap_or(0.);

        let unbound_output = self.output + (p_term + i_term + d_term) * self.output_gain;

        // Limiting output to configured bounds
        self.output = unbound_output.clamp(self.min_output, self.max_output);

        self.update_error(error);

        self.output
    }

    fn update_error(&mut self, error: f64) {
        self.error_k_2 = self.error_k_1.replace(error);
    }

    fn reset_error(&mut self) {
        self.error_k_2 = None;
        self.error_k_1 = None;
    }

    pub fn set_min(&mut self, min: f64) {
        self.min_output = min;
    }

    pub fn set_max(&mut self, max: f64) {
        self.max_output = max;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ntest::assert_about_eq;

    #[test]
    fn pid_init() {
        let pid = PidController::new(1., 1., 1., 0., 1., 1., 1.);

        assert!(pid.output == 0.)
    }

    #[test]
    fn proportional() {
        let mut pid = PidController::new(2.0, 0.0, 0.0, 0.0, 100.0, 10.0, 1.);
        assert_about_eq!(pid.setpoint, 10.);

        // Test simple proportional
        assert_about_eq!(pid.next_control_output(0.0, None), 20.);
    }

    #[test]
    fn derivative() {
        let mut pid = PidController::new(0.0, 0.0, 2.0, -100.0, 100., 10.0, 1.);

        // No derivative term for first two updates
        assert_about_eq!(pid.next_control_output(0.0, None), 0.);
        assert_about_eq!(pid.next_control_output(0.0, None), 0.);

        // Test that there's a derivative at 3rd update
        assert_about_eq!(pid.next_control_output(5.0, None), -10.);

        // Then no more derivative term
        assert_about_eq!(pid.next_control_output(5.0, None), 0.);
        assert_about_eq!(pid.next_control_output(5.0, None), 0.);
    }

    #[test]
    fn integral() {
        let mut pid = PidController::new(0.0, 2.0, 0.0, 0., 100.0, 10.0, 1.);

        // Test basic integration
        assert_about_eq!(pid.next_control_output(0.0, None), 20.);
        assert_about_eq!(pid.next_control_output(0.0, None), 40.);
        assert_about_eq!(pid.next_control_output(5.0, None), 50.);

        // Test that error integral accumulates negative values
        let mut pid2 = PidController::new(0.0, 2.0, 0.0, -100., 100.0, -10.0, 1.);
        assert_about_eq!(pid2.next_control_output(0.0, None), -20.);
        assert_about_eq!(pid2.next_control_output(0.0, None), -40.);
    }

    #[test]
    fn output_limit() {
        let mut pid = PidController::new(1.0, 0.0, 0.0, -1., 1.0, 10.0, 1.);

        let out = pid.next_control_output(0.0, None);
        assert!((out - 1.).abs() < f64::EPSILON);

        let out = pid.next_control_output(20.0, None);

        assert_about_eq!(out, -1.);
    }

    #[test]
    fn pid() {
        let mut pid = PidController::new(1.0, 0.1, 1.0, -100.0, 100.0, 10.0, 1.);

        let out = pid.next_control_output(0.0, None);
        assert_about_eq!(out, 11.);

        let out = pid.next_control_output(5.0, None);
        assert_about_eq!(out, 6.5);

        let out = pid.next_control_output(11.0, None);
        assert_about_eq!(out, -0.6);

        let out = pid.next_control_output(10.0, None);
        assert_about_eq!(out, 7.4);
    }
}

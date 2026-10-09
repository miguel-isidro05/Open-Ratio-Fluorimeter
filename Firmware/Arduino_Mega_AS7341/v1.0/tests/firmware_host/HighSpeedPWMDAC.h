#ifndef HIGHSPEEDPWM_DAC_H
#define HIGHSPEEDPWM_DAC_H

#include <Arduino.h>

class HighSpeedPWMDAC {
public:
  explicit HighSpeedPWMDAC(uint8_t pin = 9) : _pin(pin), _vcc(5.0f), _begun(false) {}

  void begin() {
    testPwmPin = _pin;
    _begun = true;
    setRaw(0);
  }

  void setVoltage(float volts) {
    if (volts <= 0.0f) setRaw(0);
    else if (volts >= _vcc) setRaw(kMaxValue);
    else setRaw(static_cast<uint16_t>(volts * kMaxValue / _vcc + 0.5f));
  }

  void setRaw(uint16_t value) {
    if (!_begun) return;
    testPwmValue = value > kMaxValue ? kMaxValue : value;
  }

  void release() { _begun = false; }

  // Getters
  uint8_t getPin() const { return _pin; }
  float getVcc() const { return _vcc; }

  static const uint16_t kMaxValue = 1023;

private:
  uint8_t _pin;
  float _vcc;
  bool _begun;
};

#endif // HIGHSPEEDPWM_DAC_H

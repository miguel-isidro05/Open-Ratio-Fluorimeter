#ifndef HIGHSPEEDPWM_DAC_H
#define HIGHSPEEDPWM_DAC_H

#include <Arduino.h>

#if defined(__AVR__)
#include <avr/io.h>
#endif

class HighSpeedPWMDAC {
 public:
  // The Mega 2560 routes OC1A to D11; ATmega328P boards use D9.
  explicit HighSpeedPWMDAC(uint8_t pin = 9) : _pin(pin), _vcc(5.0f), _begun(false) {}

  // Timer1 runs Fast PWM at 10-bit resolution with no prescaler.
  void begin() {
#if defined(__AVR_ATmega2560__) || defined(__AVR_ATmega1280__)
    if (_pin != 11) return;
#elif defined(__AVR_ATmega328P__)
    if (_pin != 9) return;
#else
    return;
#endif

    pinMode(_pin, OUTPUT);
    TCCR1A = _BV(COM1A1) | _BV(WGM11) | _BV(WGM10);
    TCCR1B = _BV(WGM12) | _BV(CS10);
    TCNT1 = 0;
    _begun = true;
    setRaw(0);
  }

  void setVoltage(float volts) {
    if (volts <= 0.0f) {
      setRaw(0);
    } else if (volts >= _vcc) {
      setRaw(kMaxValue);
    } else {
      setRaw(static_cast<uint16_t>(volts * kMaxValue / _vcc + 0.5f));
    }
  }

  void setRaw(uint16_t value) {
    if (!_begun) return;
    if (value > kMaxValue) value = kMaxValue;

    if (value == 0 || value == kMaxValue) {
      TCCR1A &= ~(_BV(COM1A1) | _BV(COM1A0));
      digitalWrite(_pin, value == 0 ? LOW : HIGH);
      return;
    }

    OCR1A = value;
    TCCR1A = (TCCR1A & ~(_BV(COM1A1) | _BV(COM1A0))) | _BV(COM1A1);
  }

  void release() {
    if (!_begun) return;
    TCCR1A &= ~(_BV(COM1A1) | _BV(COM1A0));
    pinMode(_pin, INPUT);
    _begun = false;
  }

  uint8_t getPin() const { return _pin; }
  float getVcc() const { return _vcc; }

  static const uint16_t kMaxValue = 1023;

 private:
  uint8_t _pin;
  float _vcc;
  bool _begun;
};

#endif
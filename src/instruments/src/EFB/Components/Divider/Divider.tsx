import React from 'react';
import classNames from 'classnames';

const Divider = ({ className, ...props }) => <div className={classNames(['bg-white h-0.5', className])} {...props} />;

export default Divider;
